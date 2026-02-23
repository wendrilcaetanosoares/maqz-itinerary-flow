
CREATE OR REPLACE FUNCTION public.check_task_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  all_completed BOOLEAN;
  assignee_count INTEGER;
BEGIN
  IF NEW.completed = true AND OLD.completed = false THEN
    NEW.completed_at = now();
  END IF;
  
  SELECT COUNT(*) = 0 OR bool_and(completed), COUNT(*)
  INTO all_completed, assignee_count
  FROM public.task_assignees
  WHERE task_id = NEW.task_id;
  
  IF assignee_count > 0 AND all_completed THEN
    UPDATE public.tasks SET status = 'concluida' WHERE id = NEW.task_id AND status != 'concluida';
  END IF;
  
  RETURN NEW;
END;
$function$;
