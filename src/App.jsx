import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Filter, 
  Wifi, 
  WifiOff, 
  CloudUpload, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Phone, 
  Smile, 
  Users, 
  Pipette, 
  MessageSquare 
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Paleta de colores estilo Neumórfico Oscuro
const COLOR_OPTIONS = [
  { color: 'bg-[#fef3c7]', hex: '#fef3c7', text: 'text-amber-950', label: 'Crema' },
  { color: 'bg-[#e0e7ff]', hex: '#e0e7ff', text: 'text-indigo-950', label: 'Lavanda' },
  { color: 'bg-[#93c5fd]', hex: '#93c5fd', text: 'text-blue-950', label: 'Celeste' },
  { color: 'bg-[#f472b6]', hex: '#f472b6', text: 'text-pink-950', label: 'Rosa' },
  { color: 'bg-[#34d399]', hex: '#34d399', text: 'text-emerald-950', label: 'Menta' },
  { color: 'bg-[#fbbf24]', hex: '#fbbf24', text: 'text-amber-950', label: 'Dorado' }
];

const DEFAULT_PROJECTS = [
  { id: 'p1', name: 'Diseño UI/UX', color: 'bg-[#93c5fd]', hex: '#93c5fd' },
  { id: 'p2', name: 'Personal', color: 'bg-[#34d399]', hex: '#34d399' },
  { id: 'p3', name: 'Proyectos', color: 'bg-[#f472b6]', hex: '#f472b6' }
];

// Eventos iniciales correspondientes al mes actual en curso
const getInitialEvents = () => {
  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentDay = now.getDate();

  return [
    {
      id: 'e1',
      title: 'Discusión de UI/UX para el nuevo proyecto',
      time: `${currentDay} de ${currentMonthName} - 11:00 AM a 12:00 PM`,
      type: 'meet',
      link: 'meet.google.com/notel-project',
      projectId: 'p1'
    },
    {
      id: 'e2',
      title: 'Kenjo Assou',
      time: 'Llamando... 11:00 AM',
      type: 'meet',
      link: '',
      projectId: 'p1'
    }
  ];
};

const STORAGE_KEYS = {
  TASKS: 'midia_offline_tasks',
  PROJECTS: 'midia_offline_projects',
  EVENTS: 'midia_offline_events',
  QUEUE: 'midia_offline_queue'
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Estado de red
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Fecha y Calendario actual (detecta today automáticamente)
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(() => new Date().getDate());

  // Datos
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return saved ? JSON.parse(saved) : DEFAULT_PROJECTS;
    } catch { return DEFAULT_PROJECTS; }
  });

  const [events, setEvents] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return saved ? JSON.parse(saved) : getInitialEvents();
    } catch { return getInitialEvents(); }
  });

  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'agenda'
  const [selectedFilterProjectId, setSelectedFilterProjectId] = useState('all');

  // Formulario nueva tarea
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Modales
  const [editingTask, setEditingTask] = useState(null);
  const [eventModal, setEventModal] = useState({ open: false, isEditing: false, data: null });
  const [projectModal, setProjectModal] = useState(false);

  // Estado formularios
  const [eventForm, setEventForm] = useState({
    title: '',
    time: '11:00 AM - 12:00 PM',
    type: 'meet',
    link: '',
    projectId: ''
  });

  const [projectForm, setProjectForm] = useState({
    name: '',
    color: 'bg-[#93c5fd]',
    hex: '#93c5fd'
  });

  // Guardar en caché offline
  const saveOfflineCache = useCallback((newTasks, newProjects, newEvents) => {
    try {
      if (newTasks) localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(newTasks));
      if (newProjects) localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(newProjects));
      if (newEvents) localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(newEvents));
    } catch (e) {
      console.warn('Error guardando cache:', e);
    }
  }, []);

  // Encolar acciones offline
  const enqueueOfflineAction = useCallback((action) => {
    try {
      const q = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE) || '[]');
      q.push(action);
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(q));
      setPendingSyncCount(q.length);
    } catch (e) {
      console.warn('Error encolando acción:', e);
    }
  }, []);

  // Sincronizar cola
  const syncPendingActions = useCallback(async () => {
    if (!navigator.onLine) return;
    const q = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE) || '[]');
    if (q.length === 0) return;

    try {
      setSyncing(true);
      const remaining = [];

      for (const item of q) {
        try {
          if (item.type === 'ADD_TASK') await supabase.from('tasks').insert(item.payload);
          else if (item.type === 'UPDATE_TASK') await supabase.from('tasks').update(item.payload.data).eq('id', item.payload.id);
          else if (item.type === 'DELETE_TASK') await supabase.from('tasks').delete().eq('id', item.payload.id);
          else if (item.type === 'ADD_EVENT') await supabase.from('events').insert(item.payload);
          else if (item.type === 'UPDATE_EVENT') await supabase.from('events').update(item.payload.data).eq('id', item.payload.id);
          else if (item.type === 'DELETE_EVENT') await supabase.from('events').delete().eq('id', item.payload.id);
          else if (item.type === 'ADD_PROJECT') await supabase.from('projects').insert(item.payload);
          else if (item.type === 'DELETE_PROJECT') await supabase.from('projects').delete().eq('id', item.payload.id);
        } catch {
          remaining.push(item);
        }
      }

      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(remaining));
      setPendingSyncCount(remaining.length);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Eventos de conectividad
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); syncPendingActions(); };
    const onOffline = () => { setIsOnline(false); };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const q = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE) || '[]');
    setPendingSyncCount(q.length);
    if (navigator.onLine && q.length > 0) syncPendingActions();

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [syncPendingActions]);

  // Sesión Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Carga de datos de Supabase
  const loadUserData = useCallback(async (userId) => {
    if (!navigator.onLine) return;

    try {
      setDataLoading(true);
      await syncPendingActions();

      // Proyectos
      const { data: userProjects } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true });

      let currentProjects = userProjects || [];
      if (currentProjects.length === 0) {
        const { data: newProjects } = await supabase
          .from('projects')
          .insert(DEFAULT_PROJECTS.map(p => ({ ...p, user_id: userId })))
          .select();
        if (newProjects) currentProjects = newProjects;
      }

      setProjects(currentProjects);
      saveOfflineCache(null, currentProjects, null);
      if (currentProjects.length > 0) {
        setNewTaskProjectId(currentProjects[0].id);
        setEventForm(prev => ({ ...prev, projectId: currentProjects[0].id }));
      }

      // Tareas
      const { data: userTasks } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      const mappedTasks = (userTasks || []).map(t => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        projectId: t.project_id
      }));
      setTasks(mappedTasks);
      saveOfflineCache(mappedTasks, null, null);

      // Eventos
      const { data: userEvents } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: true });

      if (userEvents && userEvents.length > 0) {
        const mappedEvents = userEvents.map(e => ({
          id: e.id,
          title: e.title,
          time: e.time,
          type: e.type,
          link: e.link,
          projectId: e.project_id
        }));
        setEvents(mappedEvents);
        saveOfflineCache(null, null, mappedEvents);
      } else {
        const initialMock = getInitialEvents();
        setEvents(initialMock);
        saveOfflineCache(null, null, initialMock);
      }

    } catch (err) {
      console.warn('Error sincronizando con Supabase:', err);
    } finally {
      setDataLoading(false);
    }
  }, [syncPendingActions, saveOfflineCache]);

  useEffect(() => {
    if (session?.user?.id) loadUserData(session.user.id);
  }, [session, loadUserData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTasks([]);
    setProjects([]);
    setEvents([]);
    localStorage.clear();
  };

  // CRUD TAREAS
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !session?.user?.id) return;

    const tempId = 't-' + Date.now();
    const projId = newTaskProjectId || projects[0]?.id;
    const newTask = { id: tempId, title: newTaskTitle.trim(), completed: false, projectId: projId };

    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveOfflineCache(updated, null, null);
    setNewTaskTitle('');

    const payload = {
      id: tempId,
      title: newTask.title,
      completed: false,
      project_id: projId,
      user_id: session.user.id
    };

    if (navigator.onLine) {
      try {
        setSubmittingTask(true);
        const { data } = await supabase.from('tasks').insert([payload]).select().single();
        if (data) setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id } : t));
      } catch {
        enqueueOfflineAction({ type: 'ADD_TASK', payload });
      } finally {
        setSubmittingTask(false);
      }
    } else {
      enqueueOfflineAction({ type: 'ADD_TASK', payload });
    }
  };

  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;
    const updated = tasks.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t);
    setTasks(updated);
    saveOfflineCache(updated, null, null);

    if (navigator.onLine) {
      try {
        await supabase.from('tasks').update({ completed: newCompleted }).eq('id', taskId);
      } catch {
        enqueueOfflineAction({ type: 'UPDATE_TASK', payload: { id: taskId, data: { completed: newCompleted } } });
      }
    } else {
      enqueueOfflineAction({ type: 'UPDATE_TASK', payload: { id: taskId, data: { completed: newCompleted } } });
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;

    const updated = tasks.map(t => 
      t.id === editingTask.id ? { ...t, title: editingTask.title.trim(), projectId: editingTask.projectId } : t
    );
    setTasks(updated);
    saveOfflineCache(updated, null, null);

    const dataToUpdate = { title: editingTask.title.trim(), project_id: editingTask.projectId };

    if (navigator.onLine) {
      try {
        await supabase.from('tasks').update(dataToUpdate).eq('id', editingTask.id);
      } catch {
        enqueueOfflineAction({ type: 'UPDATE_TASK', payload: { id: editingTask.id, data: dataToUpdate } });
      }
    } else {
      enqueueOfflineAction({ type: 'UPDATE_TASK', payload: { id: editingTask.id, data: dataToUpdate } });
    }
    setEditingTask(null);
  };

  const deleteTask = async (taskId) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    saveOfflineCache(updated, null, null);

    if (navigator.onLine) {
      try {
        await supabase.from('tasks').delete().eq('id', taskId);
      } catch {
        enqueueOfflineAction({ type: 'DELETE_TASK', payload: { id: taskId } });
      }
    } else {
      enqueueOfflineAction({ type: 'DELETE_TASK', payload: { id: taskId } });
    }
  };

  // CRUD EVENTOS
  const openCreateEventModal = () => {
    const currentMonthName = MONTH_NAMES[currentDate.getMonth()];
    setEventForm({
      title: '',
      time: `${selectedCalendarDay} de ${currentMonthName} - 11:00 AM a 12:00 PM`,
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

    if (eventModal.isEditing && eventModal.data) {
      const updated = events.map(ev => 
        ev.id === eventModal.data.id ? {
          ...ev,
          title: eventForm.title.trim(),
          time: eventForm.time,
          type: eventForm.type,
          link: eventForm.link.trim(),
          projectId: eventForm.projectId
        } : ev
      );
      setEvents(updated);
      saveOfflineCache(null, null, updated);

      const dataToUpdate = {
        title: eventForm.title.trim(),
        time: eventForm.time,
        type: eventForm.type,
        link: eventForm.link.trim(),
        project_id: eventForm.projectId
      };

      if (navigator.onLine) {
        try {
          await supabase.from('events').update(dataToUpdate).eq('id', eventModal.data.id);
        } catch {
          enqueueOfflineAction({ type: 'UPDATE_EVENT', payload: { id: eventModal.data.id, data: dataToUpdate } });
        }
      } else {
        enqueueOfflineAction({ type: 'UPDATE_EVENT', payload: { id: eventModal.data.id, data: dataToUpdate } });
      }
    } else {
      const tempId = 'e-' + Date.now();
      const newEvent = {
        id: tempId,
        title: eventForm.title.trim(),
        time: eventForm.time,
        type: eventForm.type,
        link: eventForm.link.trim(),
        projectId: eventForm.projectId || projects[0]?.id
      };

      const updated = [...events, newEvent];
      setEvents(updated);
      saveOfflineCache(null, null, updated);

      const payload = {
        id: tempId,
        title: newEvent.title,
        time: newEvent.time,
        type: newEvent.type,
        link: newEvent.link,
        project_id: newEvent.projectId,
        user_id: session.user.id
      };

      if (navigator.onLine) {
        try {
          const { data } = await supabase.from('events').insert([payload]).select().single();
          if (data) setEvents(prev => prev.map(ev => ev.id === tempId ? { ...ev, id: data.id } : ev));
        } catch {
          enqueueOfflineAction({ type: 'ADD_EVENT', payload });
        }
      } else {
        enqueueOfflineAction({ type: 'ADD_EVENT', payload });
      }
    }
    setEventModal({ open: false, isEditing: false, data: null });
  };

  const handleDeleteEvent = async (eventId) => {
    const updated = events.filter(e => e.id !== eventId);
    setEvents(updated);
    saveOfflineCache(null, null, updated);

    if (navigator.onLine) {
      try {
        await supabase.from('events').delete().eq('id', eventId);
      } catch {
        enqueueOfflineAction({ type: 'DELETE_EVENT', payload: { id: eventId } });
      }
    } else {
      enqueueOfflineAction({ type: 'DELETE_EVENT', payload: { id: eventId } });
    }
  };

  // CRUD PROYECTOS
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.name.trim() || !session?.user?.id) return;

    const tempId = 'p-' + Date.now();
    const newProj = {
      id: tempId,
      name: projectForm.name.trim(),
      color: projectForm.color,
      hex: projectForm.hex
    };

    const updated = [...projects, newProj];
    setProjects(updated);
    saveOfflineCache(null, updated, null);
    setProjectForm({ name: '', color: 'bg-[#93c5fd]', hex: '#93c5fd' });
    setProjectModal(false);

    const payload = {
      id: tempId,
      name: newProj.name,
      color: newProj.color,
      hex: newProj.hex,
      user_id: session.user.id
    };

    if (navigator.onLine) {
      try {
        const { data } = await supabase.from('projects').insert([payload]).select().single();
        if (data) setProjects(prev => prev.map(p => p.id === tempId ? data : p));
      } catch {
        enqueueOfflineAction({ type: 'ADD_PROJECT', payload });
      }
    } else {
      enqueueOfflineAction({ type: 'ADD_PROJECT', payload });
    }
  };

  const getProjectDetails = (projectId) => {
    return projects.find(p => p.id === projectId) || projects[0] || {
      name: 'General',
      color: 'bg-[#93c5fd]',
      hex: '#93c5fd'
    };
  };

  // Navegación de mes del calendario
  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const nextDate = new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
      // Ajustar selectedCalendarDay si el nuevo mes tiene menos días
      const daysInNextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      setSelectedCalendarDay(curr => Math.min(curr, daysInNextMonth));
      return nextDate;
    });
  };

  // Lógica de alineación real del calendario (días del mes con sus días de semana D, L, M, M, J, V, S)
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentMonthName = MONTH_NAMES[currentMonth];
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Domingo, 1 = Lunes, etc.
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Filtrado de tareas
  const filteredTasks = selectedFilterProjectId === 'all' 
    ? tasks 
    : tasks.filter(t => t.projectId === selectedFilterProjectId);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0d11] flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#34d399]" />
        <p className="text-sm text-neutral-400">Iniciando Mi Día...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-[#0b0d11] text-slate-100 font-sans p-3 sm:p-6 md:p-8 flex justify-center pb-28 md:pb-8 selection:bg-[#34d399] selection:text-black">
      
      {/* Contenedor Principal */}
      <div className="max-w-6xl w-full flex flex-col md:flex-row gap-6 items-start">
        
        {/* ======================================================== */}
        {/* SIDEBAR FLOTANTE VERTICAL */}
        {/* ======================================================== */}
        <aside className="hidden lg:flex flex-col items-center justify-between bg-[#181a20] border border-white/5 rounded-[36px] py-6 px-3 shadow-2xl shadow-black/80 w-16 flex-shrink-0 sticky top-8">
          
          <div className="w-10 h-10 rounded-2xl bg-[#22252c] border border-white/5 flex items-center justify-center text-xl shadow-inner mb-6">
            👍
          </div>

          <div className="flex flex-col items-center gap-6">
            <button
              onClick={() => openCreateEventModal()}
              title="Añadir evento"
              className="text-neutral-400 hover:text-white transition-colors p-2"
            >
              <Plus className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              title="Tareas"
              className="relative p-2 text-neutral-400 hover:text-white transition-colors"
            >
              <ListTodo className={`w-5 h-5 ${activeTab === 'tasks' ? 'text-[#34d399]' : ''}`} />
              {activeTab === 'tasks' && (
                <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#34d399]"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('agenda')}
              title="Agenda y Calendario"
              className="relative p-2 text-neutral-400 hover:text-white transition-colors"
            >
              <CalendarIcon className={`w-5 h-5 ${activeTab === 'agenda' ? 'text-[#34d399]' : ''}`} />
              {activeTab === 'agenda' && (
                <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#34d399]"></span>
              )}
            </button>

            <button
              onClick={() => setProjectModal(true)}
              title="Proyectos"
              className="text-neutral-400 hover:text-white transition-colors p-2"
            >
              <Users className="w-5 h-5" />
            </button>

            <button
              onClick={() => alert(`Usuario conectado: ${session?.user?.email}`)}
              title="Información de cuenta"
              className="text-neutral-400 hover:text-white transition-colors p-2"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="mt-6 p-2 text-neutral-500 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </aside>

        {/* ======================================================== */}
        {/* GRID CENTRAL: 2 COLUMNAS */}
        {/* ======================================================== */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          
          {/* ------------------------------------------------------ */}
          {/* COLUMNA 1: Calendario, Selector de Color y Tareas */}
          {/* ------------------------------------------------------ */}
          <div className={`lg:col-span-6 space-y-6 ${activeTab === 'tasks' ? 'block' : 'hidden lg:block'}`}>
            
            {/* Header móvil y barra de estado */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Mi Día</h1>
                <p className="text-xs text-neutral-400">
                  {tasks.filter(t => !t.completed).length} tareas pendientes para hoy
                </p>
              </div>

              {/* Indicador Offline / Online */}
              <div className="flex items-center gap-2">
                {!isOnline ? (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-3 py-1 rounded-full font-medium">
                    <WifiOff className="w-3.5 h-3.5" /> Offline
                  </span>
                ) : pendingSyncCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 bg-[#34d399]/10 text-[#34d399] text-xs px-3 py-1 rounded-full font-medium">
                    <CloudUpload className="w-3.5 h-3.5 animate-bounce" /> Subiendo ({pendingSyncCount})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-[#181a20] border border-white/5 text-neutral-400 text-xs px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-[#34d399]"></span> En línea
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="lg:hidden p-2 text-neutral-400 hover:text-rose-400 bg-[#181a20] rounded-xl border border-white/5"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TARJETA 1: Calendario Real con alineación exacta D, L, M, M, J, V, S */}
            <div className="bg-[#181a20] border border-white/5 rounded-[28px] p-5 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm sm:text-base capitalize">
                    {currentMonthName}, {currentYear}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => navigateMonth(-1)}
                      title="Mes anterior"
                      className="p-1 text-neutral-400 hover:text-white rounded-lg transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => navigateMonth(1)}
                      title="Mes siguiente"
                      className="p-1 text-neutral-400 hover:text-white rounded-lg transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => openCreateEventModal()}
                  title="Nuevo evento"
                  className="text-amber-400 hover:text-amber-300 font-bold text-lg p-1 transition-transform hover:scale-110"
                >
                  +
                </button>
              </div>

              {/* Iniciales en Español: D, L, M, M, J, V, S con fines de semana en rojo coral */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold mb-3">
                <span className="text-rose-400">D</span>
                <span className="text-neutral-400">L</span>
                <span className="text-neutral-400">M</span>
                <span className="text-neutral-400">M</span>
                <span className="text-neutral-400">J</span>
                <span className="text-neutral-400">V</span>
                <span className="text-rose-400">S</span>
              </div>

              {/* Días alineados con sus días de semana reales */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {/* Celdas vacías para alinear el primer día del mes */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="w-9 h-9" />
                ))}

                {/* Días reales del mes */}
                {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map(day => {
                  const isSelected = selectedCalendarDay === day;
                  const isToday = 
                    today.getDate() === day && 
                    today.getMonth() === currentMonth && 
                    today.getFullYear() === currentYear;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedCalendarDay(day)}
                      className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center font-bold transition-all ${
                        isSelected
                          ? 'bg-[#34d399] text-[#0b0d11] shadow-lg shadow-[#34d399]/30 scale-105'
                          : isToday
                          ? 'bg-[#121417] text-[#34d399] border border-[#34d399]/50 hover:bg-[#20232a]'
                          : 'bg-[#121417] text-neutral-300 hover:bg-[#20232a]'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TARJETA 2: Selector de Color ("ELIGE UN COLOR :") */}
            <div className="bg-[#181a20] border border-white/5 rounded-[28px] p-5 shadow-2xl shadow-black/50">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-3">
                ELIGE UN COLOR :
              </h3>
              
              <div className="flex items-center gap-3">
                {COLOR_OPTIONS.slice(0, 4).map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setProjectForm(prev => ({ ...prev, color: c.color, hex: c.hex }))}
                    className={`w-10 h-10 rounded-2xl ${c.color} flex items-center justify-center transition-transform hover:scale-105 shadow-inner ${
                      projectForm.hex === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#181a20]' : ''
                    }`}
                  >
                    {projectForm.hex === c.hex && (
                      <Check className={`w-4 h-4 ${c.text} stroke-[3]`} />
                    )}
                  </button>
                ))}

                {/* Divisor vertical */}
                <div className="h-6 w-px bg-white/10 mx-1"></div>

                <button
                  onClick={() => setProjectModal(true)}
                  title="Crear nuevo proyecto con color"
                  className="w-10 h-10 rounded-2xl bg-[#34d399] text-[#0b0d11] flex items-center justify-center transition-transform hover:scale-105 shadow-lg shadow-[#34d399]/20"
                >
                  <Pipette className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TARJETA 3: Evento rápido con formato en español (ej. "6 de Octubre") */}
            <div className="bg-[#181a20] border border-white/5 rounded-[28px] p-4 flex items-center gap-4 shadow-2xl shadow-black/50">
              <div className="w-12 h-12 rounded-2xl bg-[#34d399] flex items-center justify-center text-[#0b0d11] shadow-lg shadow-[#34d399]/20 flex-shrink-0">
                <CalendarIcon className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-neutral-400 font-medium block">
                  {selectedCalendarDay} de {currentMonthName}
                </span>
                <span className="text-sm font-bold text-white tracking-wide">
                  11:00 AM - 12:00 PM
                </span>
              </div>
            </div>

            {/* FORMULARIO PARA AGREGAR TAREA */}
            <form onSubmit={handleAddTask} className="bg-[#181a20] border border-white/5 rounded-[24px] p-2 flex items-center gap-2 shadow-2xl">
              <input
                type="text"
                placeholder="Nueva tarea pendiente..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none"
              />
              <select
                value={newTaskProjectId}
                onChange={(e) => setNewTaskProjectId(e.target.value)}
                className="bg-[#121417] text-neutral-300 text-xs rounded-xl px-2.5 py-2.5 border border-white/5 focus:outline-none cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!newTaskTitle.trim() || submittingTask}
                className="bg-[#34d399] text-[#0b0d11] p-2.5 rounded-xl font-bold hover:bg-[#2ecc71] transition-all disabled:opacity-40"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </form>

            {/* LISTA DE TAREAS */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Tus Tareas ({filteredTasks.length})
                </h3>
                {/* Filtro rápido */}
                <div className="flex gap-1.5 overflow-x-auto text-[11px]">
                  <button
                    onClick={() => setSelectedFilterProjectId('all')}
                    className={`px-2.5 py-1 rounded-full font-medium transition ${
                      selectedFilterProjectId === 'all' ? 'bg-[#34d399] text-[#0b0d11]' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Todas
                  </button>
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedFilterProjectId(p.id)}
                      className={`px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1 ${
                        selectedFilterProjectId === p.id ? 'bg-[#34d399] text-[#0b0d11]' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.color}`}></span>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* LÓGICA CONDICIONAL DE ESTADO VACÍO */}
              {filteredTasks.length === 0 ? (
                <div className="bg-[#181a20] border border-white/5 rounded-2xl p-6 text-center text-neutral-500 text-xs">
                  {selectedFilterProjectId === 'all'
                    ? 'No hay tareas pendientes para hoy'
                    : 'No hay tareas pendientes en este proyecto'}
                </div>
              ) : (
                filteredTasks.map(task => {
                  const proj = getProjectDetails(task.projectId);
                  return (
                    <div
                      key={task.id}
                      className="bg-[#181a20] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg hover:border-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => toggleTask(task.id)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            task.completed
                              ? 'bg-[#34d399] text-[#0b0d11] shadow-md shadow-[#34d399]/30'
                              : 'border-2 border-neutral-600 hover:border-[#34d399]'
                          }`}
                        >
                          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${proj.color}`}></span>
                            <span className="text-[10px] text-neutral-400">{proj.name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-[#121417] p-1 rounded-xl border border-white/5">
                        <button
                          onClick={() => setEditingTask(task)}
                          className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* ------------------------------------------------------ */}
          {/* COLUMNA 2: Agenda Principal, Tarjetas de Llamada y Botón CTA */}
          {/* ------------------------------------------------------ */}
          <div className={`lg:col-span-6 space-y-6 ${activeTab === 'agenda' ? 'block' : 'hidden lg:block'}`}>
            
            {/* TARJETA DESTACADA: Evento del mes en curso */}
            <div className="bg-[#181a20] border border-white/5 rounded-[28px] p-6 shadow-2xl shadow-black/50">
              
              <div className="inline-block bg-[#121417] border border-white/5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-neutral-400 uppercase mb-4">
                MEET.GOOGLE.COM
              </div>

              <div className="flex items-start gap-2.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {events[0]?.title || 'Discusión de UI/UX para el nuevo proyecto'}
                </h3>
              </div>

              <p className="text-xs text-neutral-400 mb-6 pl-4">
                {events[0]?.time || `${selectedCalendarDay} de ${currentMonthName} - 11:00 AM a 12:00 PM`}
              </p>

              <div className="flex items-center justify-between pt-2">
                <div className="bg-[#121417] p-1.5 rounded-full border border-white/5 flex items-center gap-1.5">
                  <button 
                    onClick={() => events[0] && handleDeleteEvent(events[0].id)}
                    title="Descartar"
                    className="w-9 h-9 rounded-full bg-[#181a20] text-neutral-400 hover:text-white flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => alert('Reunión confirmada')}
                    className="w-9 h-9 rounded-full bg-[#181a20] text-neutral-400 hover:text-white flex items-center justify-center transition"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => {
                      if (events[0]?.link) {
                        window.open(events[0].link.startsWith('http') ? events[0].link : `https://${events[0].link}`, '_blank');
                      } else {
                        alert('No hay enlace configurado para esta reunión.');
                      }
                    }}
                    title="Unirse o Confirmar"
                    className="w-9 h-9 rounded-full bg-[#34d399] text-[#0b0d11] flex items-center justify-center font-bold shadow-md shadow-[#34d399]/20 transition hover:scale-105"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>

                <div className="h-6 w-px bg-white/10 mx-2"></div>

                <div className="w-9 h-9 rounded-full bg-[#121417] border border-white/5 text-neutral-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>

            </div>

            {/* TARJETA 2: Llamada / Videollamada ("Llamando...") */}
            <div className="bg-[#181a20] border border-white/5 rounded-[28px] p-5 flex items-center justify-between gap-4 shadow-2xl shadow-black/50">
              
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#0b0d11] shadow-md flex-shrink-0">
                  <Phone className="w-5 h-5 stroke-[2.5]" />
                </div>
                
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-bold text-white truncate">
                    {events[1]?.title || 'Kenjo Assou'}
                  </h4>
                  <p className="text-xs text-neutral-400 truncate">
                    {events[1]?.time || 'Llamando... 11:00 AM'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => events[1] && handleDeleteEvent(events[1].id)}
                  className="w-9 h-9 rounded-full bg-[#121417] text-neutral-400 hover:text-white flex items-center justify-center border border-white/5 transition"
                >
                  <X className="w-4 h-4" />
                </button>

                <button
                  onClick={() => openCreateEventModal()}
                  className="w-9 h-9 rounded-full bg-[#34d399] text-[#0b0d11] flex items-center justify-center font-bold shadow-md shadow-[#34d399]/20 transition hover:scale-105"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>
              </div>

            </div>

            {/* LISTA ADICIONAL DE EVENTOS */}
            {events.length > 2 && (
              <div className="space-y-2">
                {events.slice(2).map(ev => (
                  <div key={ev.id} className="bg-[#181a20] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                      <p className="text-xs text-neutral-400">{ev.time}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditEventModal(ev)} className="p-1.5 text-neutral-400 hover:text-white">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteEvent(ev.id)} className="p-1.5 text-neutral-400 hover:text-rose-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BOTÓN CTA PRINCIPAL: '+ Crear Nuevo Evento' */}
            <button
              onClick={openCreateEventModal}
              className="w-full bg-[#34d399] hover:bg-[#2ecc71] text-[#0b0d11] font-bold text-base py-4 px-6 rounded-2xl shadow-xl shadow-[#34d399]/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>+ Crear Nuevo Evento</span>
            </button>

          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL: EDITAR TAREA */}
      {/* ======================================================== */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-white/10 rounded-[28px] max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Editar Tarea</h3>
              <button onClick={() => setEditingTask(null)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Título</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full bg-[#111317] border border-white/5 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#34d399]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Proyecto</label>
                <select
                  value={editingTask.projectId}
                  onChange={(e) => setEditingTask({ ...editingTask, projectId: e.target.value })}
                  className="w-full bg-[#111317] border border-white/5 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none"
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
                  className="px-4 py-2.5 text-sm text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm bg-[#34d399] text-[#0b0d11] font-bold rounded-xl hover:bg-[#2ecc71] transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EVENTO */}
      {/* ======================================================== */}
      {eventModal.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-white/10 rounded-[28px] max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {eventModal.isEditing ? 'Editar Evento' : 'Crear Nuevo Evento'}
              </h3>
              <button onClick={() => setEventModal({ open: false, isEditing: false, data: null })} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Título</label>
                <input
                  type="text"
                  placeholder="ej. Discusión de UI/UX para el proyecto"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full bg-[#111317] border border-white/5 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#34d399]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Horario</label>
                <input
                  type="text"
                  placeholder="11:00 AM - 12:00 PM"
                  value={eventForm.time}
                  onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                  className="w-full bg-[#111317] border border-white/5 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Enlace Google Meet</label>
                <input
                  type="text"
                  placeholder="meet.google.com/xyz-abc"
                  value={eventForm.link}
                  onChange={(e) => setEventForm({ ...eventForm, link: e.target.value })}
                  className="w-full bg-[#111317] border border-white/5 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Proyecto</label>
                <select
                  value={eventForm.projectId}
                  onChange={(e) => setEventForm({ ...eventForm, projectId: e.target.value })}
                  className="w-full bg-[#111317] border border-white/5 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none"
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
                  className="px-4 py-2.5 text-sm text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm bg-[#34d399] text-[#0b0d11] font-bold rounded-xl hover:bg-[#2ecc71] transition"
                >
                  Guardar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PROYECTO */}
      {/* ======================================================== */}
      {projectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-white/10 rounded-[28px] max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Nuevo Proyecto</h3>
              <button onClick={() => setProjectModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Nombre</label>
                <input
                  type="text"
                  placeholder="ej. Marketing, Finanzas, Mobile..."
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full bg-[#111317] border border-white/5 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#34d399]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Color</label>
                <div className="flex gap-2.5 items-center flex-wrap">
                  {COLOR_OPTIONS.map(opt => (
                    <button
                      key={opt.hex}
                      type="button"
                      onClick={() => setProjectForm({ ...projectForm, color: opt.color, hex: opt.hex })}
                      className={`w-9 h-9 rounded-2xl ${opt.color} flex items-center justify-center transition-transform hover:scale-105 ${
                        projectForm.hex === opt.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#181a20]' : ''
                      }`}
                    >
                      {projectForm.hex === opt.hex && <Check className="w-4 h-4 text-black stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProjectModal(false)}
                  className="px-4 py-2.5 text-sm text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm bg-[#34d399] text-[#0b0d11] font-bold rounded-xl hover:bg-[#2ecc71] transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BARRA DE NAVEGACIÓN INFERIOR MÓVIL */}
      {/* ======================================================== */}
      <div className="lg:hidden fixed bottom-3 left-4 right-4 bg-[#181a20]/95 backdrop-blur-md border border-white/10 z-40 px-6 py-2 rounded-full shadow-2xl shadow-black/80">
        <div className="flex items-center justify-around max-w-sm mx-auto">
          <button 
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`p-2 rounded-xl transition ${activeTab === 'tasks' ? 'text-[#34d399]' : 'text-neutral-500'}`}
          >
            <ListTodo className="w-6 h-6" />
          </button>
          
          <button 
            type="button"
            onClick={openCreateEventModal}
            className="w-11 h-11 rounded-full bg-[#34d399] text-[#0b0d11] flex items-center justify-center font-bold shadow-lg shadow-[#34d399]/30 -mt-4 transition active:scale-95"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`p-2 rounded-xl transition ${activeTab === 'agenda' ? 'text-[#34d399]' : 'text-neutral-500'}`}
          >
            <CalendarIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

    </div>
  );
}
