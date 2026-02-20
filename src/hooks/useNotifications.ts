import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "maqz-tasks",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }, []);

  const checkAndNotify = useCallback(async () => {
    if (!userId) return;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, status, client_name")
      .in("status", ["pendente", "em_andamento"]);

    if (!tasks || tasks.length === 0) return;

    const count = tasks.length;
    sendNotification(
      "🔔 Maqz Itinerário",
      count === 1
        ? `Você tem 1 tarefa pendente: ${tasks[0].client_name}`
        : `Você tem ${count} tarefas pendentes ou em andamento`
    );
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
          // Fetch task info
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

    // Ask permission on mount
    requestPermission().then((granted) => {
      if (!granted) return;
      // First check after 5 seconds (so it doesn't fire immediately on login)
      const initialTimeout = setTimeout(() => {
        checkAndNotify();
        // Then every hour
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
