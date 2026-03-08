import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isBusinessHour(): boolean {
  // Use Brasilia time (UTC-3)
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const brasiliaMinutes = utcMinutes + brasiliaOffset;
  const hour = Math.floor(((brasiliaMinutes % 1440) + 1440) % 1440 / 60);
  
  const dayUTC = now.getUTCDay();
  // Approximate day adjustment
  const day = brasiliaMinutes < 0 ? (dayUTC + 6) % 7 : dayUTC;

  if (day === 0) return false; // Sunday
  if (day === 6) return hour >= 8 && hour < 14; // Saturday
  return hour >= 8 && hour < 18; // Mon-Fri
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isBusinessHour()) {
      return new Response(JSON.stringify({ skipped: true, reason: "outside business hours" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending tasks with their assignees
    const { data: pendingTasks, error } = await supabaseAdmin
      .from("tasks")
      .select("id, client_name, task_assignees(user_id)")
      .eq("status", "pendente");

    if (error) throw error;
    if (!pendingTasks || pendingTasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No pending tasks" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect unique user IDs with their pending task counts
    const userTaskMap = new Map<string, number>();
    for (const task of pendingTasks) {
      const assignees = (task as any).task_assignees || [];
      for (const a of assignees) {
        userTaskMap.set(a.user_id, (userTaskMap.get(a.user_id) || 0) + 1);
      }
    }

    // Send reminders per user
    const functionUrl = `${supabaseUrl}/functions/v1/send-push`;
    let totalSent = 0;

    for (const [userId, count] of userTaskMap.entries()) {
      const body = count === 1
        ? "Você tem 1 tarefa pendente aguardando."
        : `Você tem ${count} tarefas pendentes aguardando.`;

      await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          user_ids: [userId],
          title: "🔔 Lembrete: Tarefas pendentes",
          body,
          tag: "pending-reminder",
        }),
      });
      totalSent++;
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("push-reminders error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
