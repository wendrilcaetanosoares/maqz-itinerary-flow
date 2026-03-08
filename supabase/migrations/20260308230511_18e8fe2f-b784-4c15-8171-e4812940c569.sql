
-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Function to call notify-task-events on task_assignees INSERT
CREATE OR REPLACE FUNCTION public.notify_task_assignee_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  PERFORM extensions.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/notify-task-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object('task_id', NEW.task_id, 'user_id', NEW.user_id)
    )
  );
  RETURN NEW;
END;
$$;

-- Function to call notify-task-events on tasks UPDATE
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM extensions.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/notify-task-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'record', jsonb_build_object(
          'id', NEW.id,
          'status', NEW.status,
          'client_name', NEW.client_name,
          'creator_id', NEW.creator_id,
          'status_justification', NEW.status_justification
        ),
        'old_record', jsonb_build_object(
          'status', OLD.status
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_task_assignee_insert_notify
  AFTER INSERT ON public.task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignee_insert();

CREATE TRIGGER on_task_status_change_notify
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_status_change();
