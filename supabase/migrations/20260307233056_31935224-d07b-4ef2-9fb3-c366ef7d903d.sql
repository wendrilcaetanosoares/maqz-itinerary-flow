
-- Add machine_photo_url column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS machine_photo_url text;

-- Create storage bucket for machine photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('machine-photos', 'machine-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload machine photos
CREATE POLICY "Authenticated users can upload machine photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'machine-photos');

-- Allow public read access
CREATE POLICY "Public read access for machine photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'machine-photos');

-- Allow owners and admins to delete
CREATE POLICY "Users can delete own machine photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'machine-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));
