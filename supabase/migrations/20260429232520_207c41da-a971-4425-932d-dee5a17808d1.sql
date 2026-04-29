DROP POLICY IF EXISTS "task_history_insert" ON public.task_history;

CREATE POLICY "task_history_insert" ON public.task_history
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR public.is_task_creator(task_id, auth.uid())
      OR public.is_task_assignee(task_id, auth.uid())
    )
  );