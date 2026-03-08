import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

export async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) {
    console.warn("Firebase Messaging not supported in this browser");
    return null;
  }
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function requestPushPermissionAndToken(userId: string): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    // Send config to service worker
    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (registration?.active) {
      registration.active.postMessage({
        type: "FIREBASE_CONFIG",
        config: firebaseConfig,
      });
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // Save token to database
      await supabase.from("fcm_tokens").upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" }
      );
      console.log("FCM token saved");
    }

    return token;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  getFirebaseMessaging().then((messaging) => {
    if (messaging) {
      onMessage(messaging, callback);
    }
  });
}
