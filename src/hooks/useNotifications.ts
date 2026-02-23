import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function isBusinessHour(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();

  if (day === 0) return false; // Sunday
  if (day === 6) return hour >= 8 && hour < 14; // Saturday 08-14
  return hour >= 8 && hour < 18; // Mon-Fri 08-18
}

const NOTIFIED_KEY = "maqz_last_notified_hour";

function alreadyNotifiedThisHour(): boolean {
  const stored = localStorage.getItem(NOTIFIED_KEY);
  if (!stored) return false;
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  return stored === key;
}

function markNotifiedThisHour() {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  localStorage.setItem(NOTIFIED_KEY, key);
}

export function useNotifications(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, {
        body,
        icon: "/pwa-192x192.png",
        tag: "maqz-tasks",
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // Notification API may not be available in some contexts
    }
  }, []);

  const checkAndNotify = useCallback(async () => {
    if (!userId) return;
    if (!isBusinessHour()) return;
    if (alreadyNotifiedThisHour()) return;

    try {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, status, client_name")
        .eq("status", "pendente");

      if (!tasks || tasks.length === 0) return;

      markNotifiedThisHour();

      const count = tasks.length;
      sendNotification(
        "🔔 Maqz Itinerário",
        count === 1
          ? `Você tem 1 tarefa pendente: ${tasks[0].client_name}`
          : `Você tem ${count} tarefas pendentes ou em andamento`
      );
    } catch {
      // silent fail
    }
  }, [userId, sendNotification]);

  // Subscribe to new tasks via realtime
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("new-tasks-notify")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_assignees",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (!isBusinessHour()) return;
          try {
            const { data: task } = await supabase
              .from("tasks")
              .select("client_name, type")
              .eq("id", (payload.new as { task_id: string }).task_id)
              .single();

            if (task) {
              sendNotification(
                "📋 Nova tarefa atribuída!",
                `Você recebeu uma nova tarefa: ${task.client_name}`
              );
            }
          } catch {
            // silent
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, sendNotification]);

  // Hourly reminder
  useEffect(() => {
    if (!userId) return;

    requestPermission().then((granted) => {
      if (!granted) return;
      const initialTimeout = setTimeout(() => {
        checkAndNotify();
        intervalRef.current = setInterval(checkAndNotify, 60 * 60 * 1000);
      }, 5000);

      return () => clearTimeout(initialTimeout);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, requestPermission, checkAndNotify]);

  return { requestPermission, sendNotification };
}
