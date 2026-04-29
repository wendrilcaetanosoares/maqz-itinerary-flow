-- 1) user_points: remove user-level INSERT, allow only service_role / SECURITY DEFINER trigger
DROP POLICY IF EXISTS "user_points_insert" ON public.user_points;

CREATE POLICY "user_points_service_insert" ON public.user_points
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 2) storage.objects: restrict machine-photos SELECT to task participants
DROP POLICY IF EXISTS "Authenticated users can read machine photos" ON storage.objects;
DROP POLICY IF EXISTS "machine_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "machine-photos read" ON storage.objects;

CREATE POLICY "machine_photos_select_participants" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'machine-photos'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.machine_photo_url = storage.objects.name
          AND (
            t.creator_id = auth.uid()
            OR public.is_task_assignee(t.id, auth.uid())
          )
      )
    )
  );