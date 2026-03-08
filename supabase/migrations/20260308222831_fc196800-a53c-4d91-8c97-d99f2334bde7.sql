
CREATE OR REPLACE FUNCTION public.get_task_points(task_type text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT 2
$$;
