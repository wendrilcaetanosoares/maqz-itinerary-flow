import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { type, record, old_record } = await req.json();

    async function sendPush(user_ids: string[], title: string, body: string, tag?: string) {
      const functionUrl = `${supabaseUrl}/functions/v1/send-push`;
      await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ user_ids, title, body, tag }),
      });
    }

    // Event: New task assignee (task assigned to user)
    if (type === "INSERT" && record?.task_id && record?.user_id) {
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("client_name, type")
        .eq("id", record.task_id)
        .single();

      if (task) {
        await sendPush(
          [record.user_id],
          "📋 Nova tarefa atribuída!",
          `Você recebeu uma nova tarefa: ${task.client_name} (${task.type})`,
          "new-task-assignment"
        );
      }
    }

    // Event: Task status changed
    if (type === "UPDATE" && record?.status && old_record?.status && record.status !== old_record.status) {
      const taskId = record.id;

      // Task completed
      if (record.status === "concluida" || record.status === "concluido") {
        // Get all assignees who completed
        const { data: assignees } = await supabaseAdmin
          .from("task_assignees")
          .select("user_id")
          .eq("task_id", taskId)
          .eq("completed", true);

        const completedByIds = assignees?.map((a) => a.user_id) || [];

        // Get names of who completed
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, name")
          .in("user_id", completedByIds);

        const names = profiles?.map((p) => p.name).join(", ") || "Alguém";

        // Get ALL users to notify
        const { data: allProfiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id");

        const allUserIds = allProfiles?.map((p) => p.user_id) || [];

        await sendPush(
          allUserIds,
          "✅ Tarefa concluída!",
          `${names} concluiu a tarefa: ${record.client_name}`,
          `task-completed-${taskId}`
        );
      }

      // Task postponed
      if (record.status === "adiada") {
        const creatorId = record.creator_id;
        const justification = record.status_justification || "Sem justificativa informada";

        await sendPush(
          [creatorId],
          "⏳ Tarefa adiada",
          `A tarefa "${record.client_name}" foi adiada. Motivo: ${justification}`,
          `task-postponed-${taskId}`
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-task-events error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
