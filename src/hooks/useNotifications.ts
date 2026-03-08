import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestPushPermissionAndToken, onForegroundMessage } from "@/lib/firebase";
import { toast } from "sonner";

export function useNotifications(userId: string | undefined) {
  const tokenRef = useRef<string | null>(null);

  const requestPermission = useCallback(async () => {
    if (!userId) return false;
    if (!("Notification" in window)) return false;

    const token = await requestPushPermissionAndToken(userId);
    tokenRef.current = token;
    return !!token;
  }, [userId]);

  // Auto-request permission and register token on mount
  useEffect(() => {
    if (!userId) return;

    // Register service worker for Firebase
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then(() => {
          // Small delay to let SW activate
          setTimeout(() => {
            requestPermission();
          }, 2000);
        })
        .catch((err) => console.error("SW registration failed:", err));
    }

    // Listen for foreground messages
    onForegroundMessage((payload) => {
      const title = payload.notification?.title || "Maqz Itinerário";
      const body = payload.notification?.body || "";
      toast(title, { description: body });
    });
  }, [userId, requestPermission]);

  return { requestPermission };
}
