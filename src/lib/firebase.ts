import { initializeApp, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let firebaseConfig: Record<string, string> | null = null;
let vapidKey: string = "";

async function loadFirebaseConfig() {
  if (firebaseConfig) return firebaseConfig;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/firebase-config`,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  const data = await res.json();
  vapidKey = data.vapidKey || "";
  firebaseConfig = {
    apiKey: data.apiKey,
    authDomain: data.authDomain,
    projectId: data.projectId,
    storageBucket: data.storageBucket,
    messagingSenderId: data.messagingSenderId,
    appId: data.appId,
  };
  return firebaseConfig;
}

async function getApp() {
  if (firebaseApp) return firebaseApp;
  const config = await loadFirebaseConfig();
  firebaseApp = initializeApp(config);
  return firebaseApp;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) {
    console.warn("Firebase Messaging not supported");
    return null;
  }
  const app = await getApp();
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function requestPushPermissionAndToken(userId: string): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const config = await loadFirebaseConfig();

    // Send config to service worker
    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (registration?.active) {
      registration.active.postMessage({ type: "FIREBASE_CONFIG", config });
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await supabase.from("fcm_tokens" as any).upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" }
      );
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
