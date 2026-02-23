
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status_justification text DEFAULT NULL;
