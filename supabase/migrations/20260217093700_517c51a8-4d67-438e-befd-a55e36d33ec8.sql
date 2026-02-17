
-- ==========================================
-- Maqz Itinerário — Phase 1 Database Schema
-- ==========================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'task_applier', 'employee');

-- 2. Task type enum
CREATE TYPE public.task_type AS ENUM ('entrega', 'retirada', 'venda', 'manutencao', 'garantia', 'administrativo', 'suporte');

-- 3. Task status enum
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'concluido', 'cancelado');

-- 4. Task priority enum
CREATE TYPE public.task_priority AS ENUM ('alta', 'media', 'baixa');

-- 5. Sectors table
CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'employee',
  UNIQUE (user_id, role)
);

-- 8. Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.task_type NOT NULL,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  client_phone TEXT DEFAULT '',
  client_address TEXT DEFAULT '',
  client_cep TEXT DEFAULT '',
  machine TEXT DEFAULT '',
  scheduled_date DATE,
  scheduled_time TIME,
  deadline TIMESTAMPTZ,
  client_time_limit TEXT DEFAULT '',
  priority public.task_priority NOT NULL DEFAULT 'media',
  value NUMERIC(12,2),
  observations TEXT DEFAULT '',
  status public.task_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Task assignees (many-to-many)
CREATE TABLE public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (task_id, user_id)
);

-- 10. Task comments
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Task history (audit log)
CREATE TABLE public.task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- Enable RLS on all tables
-- ==========================================
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Security definer helper functions
-- ==========================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Check if user can create/edit tasks (admin or task_applier)
CREATE OR REPLACE FUNCTION public.can_manage_tasks(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'task_applier')
  )
$$;

-- Check if user is assigned to a task
CREATE OR REPLACE FUNCTION public.is_task_assignee(_task_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_id = _task_id AND user_id = _user_id
  )
$$;

-- Check if user is the creator of a task
CREATE OR REPLACE FUNCTION public.is_task_creator(_task_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id = _task_id AND creator_id = _user_id
  )
$$;

-- ==========================================
-- RLS Policies
-- ==========================================

-- SECTORS: everyone authenticated can read, only admin can write
CREATE POLICY "sectors_select" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors_insert" ON public.sectors FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "sectors_update" ON public.sectors FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "sectors_delete" ON public.sectors FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- PROFILES: authenticated can read all, own profile editable, admin can manage
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- USER_ROLES: own role readable, admin manages
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- TASKS: admin/creator/assignee can see; admin/task_applier can create; creator/admin can edit
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR creator_id = auth.uid() OR public.is_task_assignee(id, auth.uid()));
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_tasks(auth.uid()) AND creator_id = auth.uid());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR creator_id = auth.uid());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR creator_id = auth.uid());

-- TASK_ASSIGNEES: visible to task participants; managed by creator/admin; assignee can update own completion
CREATE POLICY "task_assignees_select" ON public.task_assignees FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_task_creator(task_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "task_assignees_insert" ON public.task_assignees FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_task_creator(task_id, auth.uid()));
CREATE POLICY "task_assignees_update" ON public.task_assignees FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_task_creator(task_id, auth.uid()));
CREATE POLICY "task_assignees_delete" ON public.task_assignees FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_task_creator(task_id, auth.uid()));

-- TASK_COMMENTS: visible to task participants; participants can insert
CREATE POLICY "task_comments_select" ON public.task_comments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_task_creator(task_id, auth.uid()) OR public.is_task_assignee(task_id, auth.uid()));
CREATE POLICY "task_comments_insert" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.is_task_creator(task_id, auth.uid()) OR public.is_task_assignee(task_id, auth.uid())));
CREATE POLICY "task_comments_delete" ON public.task_comments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

-- TASK_HISTORY: visible to task participants; system inserts (any authenticated); immutable
CREATE POLICY "task_history_select" ON public.task_history FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_task_creator(task_id, auth.uid()) OR public.is_task_assignee(task_id, auth.uid()));
CREATE POLICY "task_history_insert" ON public.task_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ==========================================
-- Triggers for updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Trigger: auto-create profile on signup
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- Trigger: auto-update task status when all assignees complete
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_task_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
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
    UPDATE public.tasks SET status = 'concluido' WHERE id = NEW.task_id AND status != 'concluido';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_assignee_completion
  AFTER UPDATE OF completed ON public.task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.check_task_completion();

-- ==========================================
-- Insert initial sectors
-- ==========================================
INSERT INTO public.sectors (name) VALUES 
  ('Balcão'),
  ('Vendas'),
  ('Montagem e Entregas'),
  ('Manutenção');

-- ==========================================
-- Indexes for performance
-- ==========================================
CREATE INDEX idx_tasks_creator ON public.tasks(creator_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_sector ON public.tasks(sector_id);
CREATE INDEX idx_task_assignees_task ON public.task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON public.task_assignees(user_id);
CREATE INDEX idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX idx_task_history_task ON public.task_history(task_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
