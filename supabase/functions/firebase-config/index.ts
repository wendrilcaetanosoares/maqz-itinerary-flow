import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const config = {
    apiKey: Deno.env.get("FIREBASE_API_KEY") || "",
    authDomain: Deno.env.get("FIREBASE_AUTH_DOMAIN") || "",
    projectId: Deno.env.get("FIREBASE_PROJECT_ID") || "",
    storageBucket: Deno.env.get("FIREBASE_STORAGE_BUCKET") || "",
    messagingSenderId: Deno.env.get("FIREBASE_MESSAGING_SENDER_ID") || "",
    appId: Deno.env.get("FIREBASE_APP_ID") || "",
    vapidKey: Deno.env.get("FIREBASE_VAPID_KEY") || "",
  };

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
