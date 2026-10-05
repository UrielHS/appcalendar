-- ====================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS Y RLS PARA SUPABASE
-- ====================================================================

-- 1. TABLA: projects (Proyectos del usuario)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'bg-blue-500',
    hex TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: tasks (Tareas vinculadas al usuario y proyecto)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: events (Eventos y reuniones del calendario)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'meet' CHECK (type IN ('meet', 'calendar')),
    link TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- ====================================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- POLÍTICAS DE SEGURIDAD RLS PARA 'projects'
-- ====================================================================
CREATE POLICY "Los usuarios pueden ver sus propios proyectos"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propios proyectos"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios proyectos"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios proyectos"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- ====================================================================
-- POLÍTICAS DE SEGURIDAD RLS PARA 'tasks'
-- ====================================================================
CREATE POLICY "Los usuarios pueden ver sus propias tareas"
    ON public.tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias tareas"
    ON public.tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias tareas"
    ON public.tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias tareas"
    ON public.tasks FOR DELETE
    USING (auth.uid() = user_id);

-- ====================================================================
-- POLÍTICAS DE SEGURIDAD RLS PARA 'events'
-- ====================================================================
CREATE POLICY "Los usuarios pueden ver sus propios eventos"
    ON public.events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propios eventos"
    ON public.events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios eventos"
    ON public.events FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios eventos"
    ON public.events FOR DELETE
    USING (auth.uid() = user_id);

-- ====================================================================
-- TRIGGER OPCIONAL: Crear proyectos por defecto al registrar nuevo usuario
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_default_projects()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.projects (user_id, name, color, hex)
    VALUES 
        (NEW.id, 'Trabajo', 'bg-blue-500', '#3b82f6'),
        (NEW.id, 'Personal', 'bg-emerald-500', '#10b981'),
        (NEW.id, 'Estudio', 'bg-purple-500', '#a855f7');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador que se activa cada vez que se registra un usuario en Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_default_projects();
