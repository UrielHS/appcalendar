import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Edit3,
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  Folder, 
  ListTodo,
  LogOut,
  Loader2,
  AlertCircle,
  X,
  Check,
  Tag,
  Filter
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';

const COLOR_OPTIONS = [
  { color: 'bg-blue-500', hex: '#3b82f6', label: 'Azul' },
  { color: 'bg-emerald-500', hex: '#10b981', label: 'Verde' },
  { color: 'bg-purple-500', hex: '#a855f7', label: 'Morado' },
  { color: 'bg-rose-500', hex: '#f43f5e', label: 'Rosa' },
  { color: 'bg-amber-500', hex: '#f59e0b', label: 'Ámbar' },
  { color: 'bg-indigo-500', hex: '#6366f1', label: 'Índigo' }
];

const DEFAULT_PROJECTS = [
  { name: 'Trabajo', color: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Personal', color: 'bg-emerald-500', hex: '#10b981' },
  { name: 'Estudio', color: 'bg-purple-500', hex: '#a855f7' }
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Datos principales
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Estados de navegación y filtros
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'agenda'
  const [selectedFilterProjectId, setSelectedFilterProjectId] = useState('all');

  // Formulario rápido para nueva tarea
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Modales de Edición / Creación
  const [editingTask, setEditingTask] = useState(null); // { id, title, projectId }
  const [eventModal, setEventModal] = useState({ open: false, isEditing: false, data: null });
  const [projectModal, setProjectModal] = useState(false);
  
  // Estado formulario evento
  const [eventForm, setEventForm] = useState({
    title: '',
    time: '10:00 AM',
    type: 'meet',
    link: '',
    projectId: ''
  });

  // Estado formulario proyecto
  const [projectForm, setProjectForm] = useState({
    name: '',
    color: 'bg-blue-500',
    hex: '#3b82f6'
  });

  // 1. Escuchar sesión de Supabase Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Cargar Proyectos, Tareas y Eventos desde Supabase
  const loadUserData = useCallback(async (userId) => {
    try {
      setDataLoading(true);
      setErrorMessage(null);

      // Cargar Proyectos
      const { data: userProjects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true });

      if (projectsError) throw projectsError;

      let currentProjects = userProjects || [];

      // Si el usuario no tiene proyectos, crear los proyectos iniciales
      if (currentProjects.length === 0) {
        const { data: newProjects, error: insertProjectsError } = await supabase
          .from('projects')
          .insert(DEFAULT_PROJECTS.map(p => ({ ...p, user_id: userId })))
          .select();

        if (!insertProjectsError && newProjects) {
          currentProjects = newProjects;
        }
      }

      setProjects(currentProjects);
      if (currentProjects.length > 0) {
        setNewTaskProjectId(currentProjects[0].id);
        setEventForm(prev => ({ ...prev, projectId: currentProjects[0].id }));
      }

      // Cargar Tareas
      const { data: userTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      setTasks((userTasks || []).map(t => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        projectId: t.project_id
      })));

      // Cargar Eventos
      const { data: userEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: true });

      if (eventsError) throw eventsError;

      setEvents((userEvents || []).map(e => ({
        id: e.id,
        title: e.title,
        time: e.time,
        type: e.type,
        link: e.link,
        projectId: e.project_id
      })));

    } catch (err) {
      console.error('Error al cargar datos desde Supabase:', err);
      setErrorMessage('No se pudieron sincronizar los datos. Revisa tus tablas en Supabase.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadUserData(session.user.id);
    }
  }, [session, loadUserData]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setTasks([]);
      setProjects([]);
      setEvents([]);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  // ==========================================
  // CRUD DE TAREAS (TASKS)
  // ==========================================

  // Crear Tarea
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !session?.user?.id) return;

    try {
      setSubmittingTask(true);
      const titleToInsert = newTaskTitle.trim();
      const projIdToInsert = newTaskProjectId || (projects[0]?.id || null);

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            title: titleToInsert,
            completed: false,
            project_id: projIdToInsert,
            user_id: session.user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTasks(prev => [{
          id: data.id,
          title: data.title,
          completed: data.completed,
          projectId: data.project_id
        }, ...prev]);
        setNewTaskTitle('');
      }
    } catch (err) {
      console.error('Error al agregar tarea:', err);
      alert('Error al guardar la tarea.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Alternar completado
  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: newCompleted })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Error al actualizar tarea:', err);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !newCompleted } : t));
    }
  };

  // Actualizar Tarea (Editar título o proyecto)
  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editingTask.title.trim(),
          project_id: editingTask.projectId
        })
        .eq('id', editingTask.id);

      if (error) throw error;

      setTasks(prev => prev.map(t => 
        t.id === editingTask.id ? { ...t, title: editingTask.title.trim(), projectId: editingTask.projectId } : t
      ));
      setEditingTask(null);
    } catch (err) {
      console.error('Error al actualizar tarea:', err);
      alert('No se pudo guardar la edición de la tarea.');
    }
  };

  // Eliminar Tarea
  const deleteTask = async (taskId) => {
    const previous = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    } catch (err) {
      console.error('Error al eliminar tarea:', err);
      setTasks(previous);
    }
  };

  // ==========================================
  // CRUD DE EVENTOS (EVENTS)
  // ==========================================

  const openCreateEventModal = () => {
    setEventForm({
      title: '',
      time: '10:00 AM',
      type: 'meet',
      link: '',
      projectId: projects[0]?.id || ''
    });
    setEventModal({ open: true, isEditing: false, data: null });
  };

  const openEditEventModal = (event) => {
    setEventForm({
      title: event.title,
      time: event.time,
      type: event.type,
      link: event.link || '',
      projectId: event.projectId
    });
    setEventModal({ open: true, isEditing: true, data: event });
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !session?.user?.id) return;

    try {
      if (eventModal.isEditing && eventModal.data) {
        // Actualizar Evento existente
        const { error } = await supabase
          .from('events')
          .update({
            title: eventForm.title.trim(),
            time: eventForm.time,
            type: eventForm.type,
            link: eventForm.link.trim(),
            project_id: eventForm.projectId
          })
          .eq('id', eventModal.data.id);

        if (error) throw error;

        setEvents(prev => prev.map(ev => 
          ev.id === eventModal.data.id ? {
            ...ev,
            title: eventForm.title.trim(),
            time: eventForm.time,
            type: eventForm.type,
            link: eventForm.link.trim(),
            projectId: eventForm.projectId
          } : ev
        ));
      } else {
        // Crear Nuevo Evento
        const { data, error } = await supabase
          .from('events')
          .insert([{
            title: eventForm.title.trim(),
            time: eventForm.time,
            type: eventForm.type,
            link: eventForm.link.trim(),
            project_id: eventForm.projectId || projects[0]?.id,
            user_id: session.user.id
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setEvents(prev => [...prev, {
            id: data.id,
            title: data.title,
            time: data.time,
            type: data.type,
            link: data.link,
            projectId: data.project_id
          }]);
        }
      }

      setEventModal({ open: false, isEditing: false, data: null });
    } catch (err) {
      console.error('Error al guardar evento:', err);
      alert('Error al guardar el evento en la agenda.');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('¿Deseas eliminar este evento?')) return;
    const previous = [...events];
    setEvents(prev => prev.filter(e => e.id !== eventId));

    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw error;
    } catch (err) {
      console.error('Error al eliminar evento:', err);
      setEvents(previous);
    }
  };

  // ==========================================
  // CRUD DE PROYECTOS (PROJECTS)
  // ==========================================

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.name.trim() || !session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name: projectForm.name.trim(),
          color: projectForm.color,
          hex: projectForm.hex,
          user_id: session.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProjects(prev => [...prev, data]);
        setProjectForm({ name: '', color: 'bg-blue-500', hex: '#3b82f6' });
        setProjectModal(false);
      }
    } catch (err) {
      console.error('Error al crear proyecto:', err);
      alert('No se pudo crear el proyecto.');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (projects.length <= 1) {
      alert('Debes mantener al menos un proyecto.');
      return;
    }
    if (!confirm('¿Eliminar este proyecto? Las tareas asociadas perderán su categoría.')) return;

    const previousProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (selectedFilterProjectId === projectId) setSelectedFilterProjectId('all');

    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    } catch (err) {
      console.error('Error al eliminar proyecto:', err);
      setProjects(previousProjects);
    }
  };

  const getProjectDetails = (projectId) => {
    return projects.find(p => p.id === projectId) || projects[0] || {
      name: 'General',
      color: 'bg-slate-400',
      hex: '#94a3b8'
    };
  };

  const formattedDate = new Intl.DateTimeFormat('es-ES', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  }).format(new Date());

  // Filtrado de tareas según el proyecto seleccionado
  const filteredTasks = selectedFilterProjectId === 'all' 
    ? tasks 
    : tasks.filter(t => t.projectId === selectedFilterProjectId);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Iniciando Mi Día...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  // Componente de Tarjeta de Tarea
  const TaskCard = ({ task }) => {
    const project = getProjectDetails(task.projectId);
    
    return (
      <div className={`group flex items-center justify-between p-3 md:p-4 mb-2 bg-white rounded-xl shadow-sm border ${task.completed ? 'border-slate-100 opacity-60' : 'border-slate-200'} transition-all`}>
        <div className="flex items-center gap-3 md:gap-4 flex-1 overflow-hidden">
          <button 
            type="button"
            onClick={() => toggleTask(task.id)}
            className={`flex-shrink-0 transition-colors ${task.completed ? 'text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}
          >
            {task.completed ? <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-slate-900" /> : <Circle className="w-5 h-5 md:w-6 md:h-6" />}
          </button>
          <div className="flex flex-col min-w-0 flex-1">
            <span className={`text-sm md:text-base font-medium truncate ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
              {task.title}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${project.color}`}></span>
              <span className="text-[10px] md:text-xs text-slate-500 font-medium">{project.name}</span>
            </div>
          </div>
        </div>

        {/* Acciones de Tarea: Editar y Borrar */}
        <div className="flex items-center gap-1">
          <button 
            type="button"
            onClick={() => setEditingTask({ id: task.id, title: task.title, projectId: task.projectId })}
            className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-slate-50 transition-colors"
            title="Editar tarea"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => deleteTask(task.id)}
            className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-slate-50 transition-colors"
            title="Eliminar tarea"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Componente de Tarjeta de Evento
  const EventCard = ({ event }) => {
    const project = getProjectDetails(event.projectId);
    
    return (
      <div className="flex flex-col p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 group" style={{ borderLeftColor: project.hex }}>
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">{event.title}</h4>
            <span className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <Clock className="w-3 h-3" />
              {event.time}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${event.type === 'meet' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
              {event.type === 'meet' ? <Video className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
            </div>

            <button
              type="button"
              onClick={() => openEditEventModal(event)}
              className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors"
              title="Editar evento"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteEvent(event.id)}
              className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
              title="Eliminar evento"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {event.link && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <a 
              href={event.link.startsWith('http') ? event.link : `https://${event.link}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 md:py-1.5 rounded-lg transition-colors w-full md:w-auto justify-center"
            >
              Unirse a Google Meet
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans md:p-8 flex justify-center pb-24 md:pb-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-3 gap-0 md:gap-8">
        
        {/* ======================================================== */}
        {/* COLUMNA IZQUIERDA: TAREAS (Mobile: Tab 'tasks') */}
        {/* ======================================================== */}
        <div className={`lg:col-span-2 space-y-6 p-4 md:p-0 ${activeTab === 'tasks' ? 'block' : 'hidden lg:block'}`}>
          
          <header className="mb-6 md:mb-8 mt-2 md:mt-0 flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2 capitalize">
                {formattedDate}
              </h1>
              <p className="text-sm md:text-base text-slate-500">
                Tienes {tasks.filter(t => !t.completed).length} tareas pendientes para hoy.
              </p>
            </div>

            {/* Perfil y Botón de Salir */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs text-slate-500 max-w-[140px] truncate">
                {session?.user?.email}
              </span>
              <button 
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-xl transition-colors shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </header>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulario Pegajoso para Nueva Tarea */}
          <form onSubmit={handleAddTask} className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2 sticky top-4 z-10">
            <input
              type="text"
              placeholder="Añadir nueva tarea..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 px-3 md:px-4 py-3 text-base text-slate-700 outline-none placeholder-slate-400 min-w-0"
            />
            
            <select
              value={newTaskProjectId}
              onChange={(e) => setNewTaskProjectId(e.target.value)}
              className="bg-slate-50 text-slate-600 text-xs md:text-sm rounded-xl px-2 md:px-3 py-3 border-none focus:ring-2 focus:ring-slate-200 outline-none appearance-none cursor-pointer max-w-[105px] md:max-w-none"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            
            <button
              type="submit"
              disabled={!newTaskTitle.trim() || submittingTask}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 flex-shrink-0"
            >
              {submittingTask ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            </button>
          </form>

          {/* Barra de Filtro por Proyecto */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 flex items-center gap-1 flex-shrink-0">
              <Filter className="w-3.5 h-3.5" /> Filtrar:
            </span>
            <button
              type="button"
              onClick={() => setSelectedFilterProjectId('all')}
              className={`px-3 py-1.5 rounded-full font-medium transition-all flex-shrink-0 ${
                selectedFilterProjectId === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Todos ({tasks.length})
            </button>
            {projects.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedFilterProjectId(p.id)}
                className={`px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  selectedFilterProjectId === p.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${p.color}`}></span>
                {p.name} ({tasks.filter(t => t.projectId === p.id).length})
              </button>
            ))}
          </div>

          {/* Lista de Tareas */}
          <div className="mt-4">
            <h2 className="text-base md:text-lg font-semibold text-slate-800 mb-3 md:mb-4 flex items-center gap-2">
              <Folder className="w-5 h-5 text-slate-400" />
              Tus Tareas
            </h2>
            
            {dataLoading ? (
              <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                <span className="text-sm">Cargando tareas de Supabase...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2 md:space-y-1">
                  {filteredTasks.filter(t => !t.completed).length === 0 ? (
                    <div className="text-center p-8 bg-white rounded-2xl border border-slate-100">
                      <p className="text-slate-400 text-sm">
                        {tasks.length === 0 
                          ? 'No tienes tareas pendientes para hoy. ¡Añade una arriba!' 
                          : 'No hay tareas pendientes en este proyecto.'}
                      </p>
                    </div>
                  ) : (
                    filteredTasks.filter(t => !t.completed).map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))
                  )}
                </div>

                {/* Tareas Completadas */}
                {filteredTasks.filter(t => t.completed).length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-slate-500 mb-3 px-2">Completadas</h3>
                    <div className="space-y-2 md:space-y-1">
                      {filteredTasks.filter(t => t.completed).map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMNA DERECHA: CALENDARIO, AGENDA Y PROYECTOS */}
        {/* ======================================================== */}
        <div className={`space-y-6 p-4 md:p-0 ${activeTab === 'agenda' ? 'block' : 'hidden lg:block'}`}>
          
          {/* Calendario Mensual */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 mt-2 md:mt-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Octubre 2026</h3>
              <div className="flex gap-2">
                <div className="w-8 h-8 md:w-6 md:h-6 rounded-full bg-slate-100 flex items-center justify-center text-sm md:text-xs text-slate-500 cursor-pointer hover:bg-slate-200">&lt;</div>
                <div className="w-8 h-8 md:w-6 md:h-6 rounded-full bg-slate-100 flex items-center justify-center text-sm md:text-xs text-slate-500 cursor-pointer hover:bg-slate-200">&gt;</div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              <span className="text-slate-400 font-medium">Do</span>
              <span className="text-slate-400 font-medium">Lu</span>
              <span className="text-slate-400 font-medium">Ma</span>
              <span className="text-slate-400 font-medium">Mi</span>
              <span className="text-slate-400 font-medium">Ju</span>
              <span className="text-slate-400 font-medium">Vi</span>
              <span className="text-slate-400 font-medium">Sa</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <div 
                  key={day} 
                  className={`w-8 h-8 flex items-center justify-center rounded-full mx-auto cursor-pointer transition-colors
                    ${day === 5 ? 'bg-slate-900 text-white font-medium shadow-md' : 'text-slate-600 hover:bg-slate-100'}
                  `}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Agenda de Hoy con Botón de "+ Nuevo Evento" */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base md:text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-slate-400" />
                Agenda de Hoy
              </h2>
              <button
                type="button"
                onClick={openCreateEventModal}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Evento</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 px-1">Sincronizado con Supabase</p>
            
            <div className="space-y-2 md:space-y-1">
              {events.length > 0 ? (
                events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-slate-500 text-sm">No tienes eventos programados.</p>
                  <button
                    type="button"
                    onClick={openCreateEventModal}
                    className="mt-3 text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Crear el primer evento
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Tus Proyectos con botón de "+ Proyecto" y eliminar */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Tus Proyectos</h3>
              <button
                type="button"
                onClick={() => setProjectModal(true)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo
              </button>
            </div>

            <div className="space-y-2">
              {projects.map(project => (
                <div key={project.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50 group">
                  <div className="flex items-center gap-3">
                    <div className={`w-3.5 h-3.5 rounded-full ${project.color}`}></div>
                    <span className="text-sm text-slate-700">{project.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(project.id)}
                    className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar proyecto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: EDITAR TAREA */}
      {/* ======================================================== */}
      {editingTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Editar Tarea</h3>
              <button 
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Proyecto</label>
                <select
                  value={editingTask.projectId}
                  onChange={(e) => setEditingTask({ ...editingTask, projectId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-medium"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREAR / EDITAR EVENTO */}
      {/* ======================================================== */}
      {eventModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {eventModal.isEditing ? 'Editar Evento' : 'Nuevo Evento de Agenda'}
              </h3>
              <button 
                onClick={() => setEventModal({ open: false, isEditing: false, data: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título del Evento</label>
                <input
                  type="text"
                  placeholder="ej. Reunión con equipo"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hora</label>
                  <input
                    type="text"
                    placeholder="10:00 AM"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select
                    value={eventForm.type}
                    onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="meet">Google Meet</option>
                    <option value="calendar">Calendario</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Enlace de llamada (opcional)</label>
                <input
                  type="text"
                  placeholder="meet.google.com/xyz-abc"
                  value={eventForm.link}
                  onChange={(e) => setEventForm({ ...eventForm, link: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Proyecto asociado</label>
                <select
                  value={eventForm.projectId}
                  onChange={(e) => setEventForm({ ...eventForm, projectId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEventModal({ open: false, isEditing: false, data: null })}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-medium"
                >
                  {eventModal.isEditing ? 'Actualizar Evento' : 'Crear Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NUEVO PROYECTO */}
      {/* ======================================================== */}
      {projectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Nuevo Proyecto</h3>
              <button 
                onClick={() => setProjectModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  placeholder="ej. Marketing, Finanzas, Deportes..."
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Color Distintivo</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {COLOR_OPTIONS.map(opt => (
                    <button
                      key={opt.color}
                      type="button"
                      onClick={() => setProjectForm({ ...projectForm, color: opt.color, hex: opt.hex })}
                      className={`w-8 h-8 rounded-full ${opt.color} flex items-center justify-center transition-transform ${
                        projectForm.color === opt.color ? 'scale-110 ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-105'
                      }`}
                    >
                      {projectForm.color === opt.color && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProjectModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-medium"
                >
                  Guardar Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BARRA DE NAVEGACIÓN INFERIOR MÓVIL (PWA) */}
      {/* ======================================================== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-6 py-2 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <button 
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'tasks' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`p-1.5 rounded-2xl mb-1 transition-all ${activeTab === 'tasks' ? 'bg-slate-100' : ''}`}>
              <ListTodo className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-medium">Tareas</span>
          </button>
          
          <button 
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`flex-1 flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'agenda' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`p-1.5 rounded-2xl mb-1 transition-all ${activeTab === 'agenda' ? 'bg-slate-100' : ''}`}>
              <CalendarIcon className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-medium">Agenda</span>
          </button>
        </div>
      </div>

    </div>
  );
}

