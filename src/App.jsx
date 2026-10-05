import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  Folder, 
  ListTodo,
  LogOut,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';

const DEFAULT_PROJECTS = [
  { name: 'Trabajo', color: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Personal', color: 'bg-emerald-500', hex: '#10b981' },
  { name: 'Estudio', color: 'bg-purple-500', hex: '#a855f7' }
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'agenda'
  const [submittingTask, setSubmittingTask] = useState(false);

  // Escuchar sesión de Supabase Auth
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

  // Cargar Proyectos, Tareas y Eventos del usuario
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

        if (insertProjectsError) {
          console.error('Error al sembrar proyectos:', insertProjectsError);
        } else if (newProjects && newProjects.length > 0) {
          currentProjects = newProjects;
        }
      }

      setProjects(currentProjects);
      if (currentProjects.length > 0) {
        setSelectedProjectId(currentProjects[0].id);
      }

      // Cargar Tareas
      const { data: userTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      const mappedTasks = (userTasks || []).map(t => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        projectId: t.project_id
      }));
      setTasks(mappedTasks);

      // Cargar Eventos
      const { data: userEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: true });

      if (eventsError) throw eventsError;

      const mappedEvents = (userEvents || []).map(e => ({
        id: e.id,
        title: e.title,
        time: e.time,
        type: e.type,
        link: e.link,
        projectId: e.project_id
      }));
      setEvents(mappedEvents);

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

  // Manejo de Cerrar Sesión
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

  // Crear Tarea en Supabase
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !session?.user?.id) return;

    try {
      setSubmittingTask(true);
      const titleToInsert = newTaskTitle.trim();
      const projIdToInsert = selectedProjectId || (projects[0]?.id || null);

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
        const newTask = {
          id: data.id,
          title: data.title,
          completed: data.completed,
          projectId: data.project_id
        };
        setTasks(prev => [newTask, ...prev]);
        setNewTaskTitle('');
      }
    } catch (err) {
      console.error('Error al agregar tarea:', err);
      alert('Error al guardar la tarea en la base de datos.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Alternar estado de completado
  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompletedState = !task.completed;

    // Actualización optimista
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: newCompletedState } : t
    ));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: newCompletedState })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Error al actualizar tarea:', err);
      // Revertir
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, completed: !newCompletedState } : t
      ));
    }
  };

  // Eliminar Tarea en Supabase
  const deleteTask = async (taskId) => {
    const previousTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Error al eliminar tarea:', err);
      setTasks(previousTasks);
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
          <div className="flex flex-col min-w-0">
            <span className={`text-sm md:text-base font-medium truncate ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
              {task.title}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${project.color}`}></span>
              <span className="text-[10px] md:text-xs text-slate-500 font-medium">{project.name}</span>
            </div>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => deleteTask(task.id)}
          className="text-slate-300 hover:text-red-500 p-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
          title="Eliminar tarea"
        >
          <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    );
  };

  const EventCard = ({ event }) => {
    const project = getProjectDetails(event.projectId);
    
    return (
      <div className="flex flex-col p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100 border-l-4" style={{ borderLeftColor: project.hex }}>
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">{event.title}</h4>
            <span className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <Clock className="w-3 h-3" />
              {event.time}
            </span>
          </div>
          <div className={`p-1.5 rounded-lg ${event.type === 'meet' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
            {event.type === 'meet' ? <Video className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
          </div>
        </div>
        
        {event.link && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <a 
              href={event.link.startsWith('http') ? event.link : `https://${event.link}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-3 md:py-1.5 rounded-lg transition-colors w-full md:w-auto justify-center"
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
        
        {/* Columna Izquierda: Tareas (Móvil: Controlado por tabs, Desktop: Ocupa 2 cols) */}
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

            {/* Perfil y Logout */}
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

          {/* Formulario Pegajoso en Móvil */}
          <form onSubmit={handleAddTask} className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2 sticky top-4 z-10">
            <input
              type="text"
              placeholder="Añadir nueva tarea..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 px-3 md:px-4 py-3 text-base text-slate-700 outline-none placeholder-slate-400 min-w-0"
            />
            
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
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

          {/* Lista de Tareas */}
          <div className="mt-6 md:mt-8">
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
                  {tasks.filter(t => !t.completed).length === 0 ? (
                    <div className="text-center p-8 bg-white rounded-2xl border border-slate-100">
                      <p className="text-slate-400 text-sm">No tienes tareas pendientes para hoy. ¡Buen trabajo!</p>
                    </div>
                  ) : (
                    tasks.filter(t => !t.completed).map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))
                  )}
                </div>

                {/* Tareas Completadas */}
                {tasks.filter(t => t.completed).length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-slate-500 mb-3 px-2">Completadas</h3>
                    <div className="space-y-2 md:space-y-1">
                      {tasks.filter(t => t.completed).map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Columna Derecha: Calendario y Eventos */}
        <div className={`space-y-6 p-4 md:p-0 ${activeTab === 'agenda' ? 'block' : 'hidden lg:block'}`}>
          
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

          <div>
            <h2 className="text-base md:text-lg font-semibold text-slate-800 mb-3 md:mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-slate-400" />
              Agenda de Hoy
            </h2>
            <p className="text-xs text-slate-500 mb-4 px-1">Sincronizado con Supabase</p>
            
            <div className="space-y-2 md:space-y-1">
              {events.length > 0 ? (
                events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-slate-500 text-sm">No tienes eventos programados para hoy.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mt-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Tus Proyectos</h3>
            <div className="space-y-3 md:space-y-2">
              {projects.length === 0 ? (
                <p className="text-xs text-slate-400">Sin proyectos creados aún.</p>
              ) : (
                projects.map(project => (
                  <div key={project.id} className="flex items-center gap-3">
                    <div className={`w-4 h-4 md:w-3 md:h-3 rounded-full ${project.color}`}></div>
                    <span className="text-sm text-slate-600">{project.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Barra de Navegación Inferior Móvil (PWA) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-6 py-2 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
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
