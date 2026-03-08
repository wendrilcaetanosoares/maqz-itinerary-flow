
-- Table to store points earned per task completion
CREATE TABLE public.user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  points integer NOT NULL,
  task_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one point entry per user per task
ALTER TABLE public.user_points ADD CONSTRAINT user_points_user_task_unique UNIQUE (user_id, task_id);

-- RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_points_select" ON public.user_points
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "user_points_insert" ON public.user_points
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Function to calculate points based on task type
CREATE OR REPLACE FUNCTION public.get_task_points(task_type text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN task_type IN ('manutencao', 'garantia') THEN 5
    WHEN task_type IN ('entrega', 'retirada') THEN 3
    WHEN task_type IN ('administrativo', 'suporte', 'venda') THEN 2
    ELSE 1
  END
$$;

-- Trigger function: when task_assignees.completed becomes true, award points
CREATE OR REPLACE FUNCTION public.award_points_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _task_type text;
  _points integer;
BEGIN
  IF NEW.completed = true AND (OLD.completed = false OR OLD.completed IS NULL) THEN
    SELECT type::text INTO _task_type FROM public.tasks WHERE id = NEW.task_id;
    _points := public.get_task_points(_task_type);
    
    INSERT INTO public.user_points (user_id, task_id, points, task_type)
    VALUES (NEW.user_id, NEW.task_id, _points, _task_type)
    ON CONFLICT (user_id, task_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_award_points
  AFTER UPDATE ON public.task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_completion();
