
-- 1. Fix user_points: drop RESTRICTIVE policies, recreate as PERMISSIVE
DROP POLICY IF EXISTS "user_points_select" ON public.user_points;
DROP POLICY IF EXISTS "user_points_insert" ON public.user_points;

CREATE POLICY "user_points_select" ON public.user_points
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "user_points_insert" ON public.user_points
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Fix tasks_update: add WITH CHECK to prevent field tampering
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR (creator_id = auth.uid()))
  WITH CHECK (creator_id = auth.uid() OR is_admin(auth.uid()));

-- 3. Fix machine-photos storage: make private
UPDATE storage.buckets SET public = false WHERE id = 'machine-photos';

-- Remove the public read policy
DROP POLICY IF EXISTS "Public read access for machine photos" ON storage.objects;

-- Add authenticated-only read policy
CREATE POLICY "Authenticated users can read machine photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'machine-photos');

-- Fix INSERT policy: add ownership check
DROP POLICY IF EXISTS "Authenticated users can upload machine photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload machine photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'machine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add UPDATE policy
CREATE POLICY "Users can update their own machine photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'machine-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));

-- Fix DELETE policy if needed
DROP POLICY IF EXISTS "Admins and task creators can delete machine photos" ON storage.objects;

CREATE POLICY "Admins and task creators can delete machine photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'machine-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));
