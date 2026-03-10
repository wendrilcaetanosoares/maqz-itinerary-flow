import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, string>;
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);

  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const claimSet = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedToken = `${header}.${claimSet}`;

  // Import the private key
  const pemContent = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedJwt = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signedJwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication: only allow service role key or admin JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Allow service role key (internal calls from triggers/other functions)
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
      // Verify as user JWT and check admin role
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user is admin
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: isAdmin } = await supabaseAdmin.rpc("is_admin", { _user_id: claims.claims.sub });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not configured");

    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
    if (!firebaseProjectId) throw new Error("FIREBASE_PROJECT_ID not configured");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    const { user_ids, title, body, tag, data } = payload;

    if (!user_ids || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: "No user_ids provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get FCM tokens for the users
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from("fcm_tokens")
      .select("token, user_id")
      .in("user_id", user_ids);

    if (tokensError) throw tokensError;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No tokens found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(serviceAccountJson);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const { token } of tokens) {
      try {
        const response = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { ...data, tag: tag || "maqz-notification" },
              webpush: {
                notification: {
                  icon: "/pwa-192x192.png",
                  badge: "/pwa-192x192.png",
                  tag: tag || "maqz-notification",
                },
                fcm_options: { link: "/" },
              },
            },
          }),
        });

        if (response.ok) {
          sent++;
        } else {
          const errData = await response.json();
          console.error("FCM send error:", JSON.stringify(errData));
          failed++;
          // If token is invalid, mark for deletion
          if (errData?.error?.code === 404 || errData?.error?.details?.[0]?.errorCode === "UNREGISTERED") {
            invalidTokens.push(token);
          }
        }
      } catch (e) {
        console.error("Error sending to token:", e);
        failed++;
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await supabaseAdmin.from("fcm_tokens").delete().in("token", invalidTokens);
    }

    return new Response(JSON.stringify({ sent, failed, invalidRemoved: invalidTokens.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
