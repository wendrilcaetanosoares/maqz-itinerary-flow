import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, password, name, role } = await req.json();

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsError } = await supabaseAdmin.auth.getUser(token);
      if (!claimsError && claims.user) {
        const { data: callerRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", claims.user.id);
        const isAdmin = callerRoles?.some((r) => r.role === "admin");
        if (!isAdmin) {
          // Allow if no users exist yet (bootstrap)
          const { count } = await supabaseAdmin
            .from("user_roles")
            .select("*", { count: "exact", head: true });
          if (count && count > 0) {
            return new Response(JSON.stringify({ error: "Não autorizado" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    } else {
      // No auth header - only allow if no users exist (bootstrap)
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      if (count && count > 0) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userData.user.id, role: role || "employee" });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile name
    await supabaseAdmin
      .from("profiles")
      .update({ name: name || email })
      .eq("user_id", userData.user.id);

    return new Response(
      JSON.stringify({ success: true, user_id: userData.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
