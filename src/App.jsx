import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowUpDown,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Clock,
  Flag,
  MessageSquare,
  Calendar as CalendarIcon,
  AlignLeft,
  Home,
  CheckSquare,
  Search,
  Plus,
  X,
  Check,
  Loader2,
  Wifi,
  WifiOff,
  LogOut,
  Edit3,
  Trash2,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';

// ====================================================================
// UTILIDADES DE FECHAS
// ====================================================================
const formatDateKey = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getTodayStr = () => formatDateKey(new Date());

const formatFriendlyDate = (date) => {
  if (!date) return '';
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
};

const formatDetailDate = (dateStr) => {
  if (!dateStr) return 'Today';
  const todayStr = getTodayStr();
  if (dateStr === todayStr) return 'Today';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === formatDateKey(tomorrow)) return 'Tomorrow';

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }
  return dateStr;
};

const MONTHS_LIST = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const DEFAULT_TASKS = [
  {
    id: 't-default-1',
    title: 'Client meeting with Burger King',
    completed: false,
    priority: 'High',
    start_time: '8:00 PM',
    end_time: '8:30 PM',
    task_date: getTodayStr(),
    comments_count: 2,
    description: 'Catch up with the Burger King team to understand their upcoming priorities, share progress on current campaigns, and brainstorm potential opportunities for collaboration.'
  },
  {
    id: 't-default-2',
    title: 'Design project',
    completed: false,
    priority: 'Medium',
    start_time: '6:00 PM',
    end_time: '7:00 PM',
    task_date: getTodayStr(),
    comments_count: 0,
    description: 'Review UI/UX layouts, refine interactive state transitions, and align design system components for tablet & mobile foldable devices.'
  },
  {
    id: 't-default-3',
    title: 'Buy a macbook',
    completed: true,
    priority: 'Low',
    start_time: '11:00 AM',
    end_time: '11:30 AM',
    task_date: getTodayStr(),
    comments_count: 0,
    description: 'Pick up the new workstation laptop and configure development dependencies.'
  }
];

const STORAGE_KEYS = {
  TASKS: 'midia_foldable_tasks',
  SELECTED_ID: 'midia_foldable_selected_id'
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Estado de red
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Fechas y Calendario
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  // Fecha seleccionada en el calendario
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  // Semana visible en el calendario (anchor date)
  const [weekAnchorDate, setWeekAnchorDate] = useState(() => new Date());

  // Modo de filtro de fecha: 'selected' (muestra tareas del día seleccionado) | 'all' (muestra todas las tareas)
  const [dateFilterMode, setDateFilterMode] = useState('selected');

  // Menú selector de mes desplegable
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Tareas con persistencia local
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(t => ({
          ...t,
          task_date: t.task_date || todayKey
        }));
      }
      return DEFAULT_TASKS;
    } catch {
      return DEFAULT_TASKS;
    }
  });

  // Tarea seleccionada (Detail Panel)
  const [selectedTaskId, setSelectedTaskId] = useState(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEYS.SELECTED_ID);
      return savedId || DEFAULT_TASKS[0].id;
    } catch {
      return DEFAULT_TASKS[0].id;
    }
  });

  // Navegación móvil (Master vs Detail)
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Pestaña en Detail panel ('details' | 'activity')
  const [activeDetailTab, setActiveDetailTab] = useState('details');

  // Secciones colapsables en Master panel
  const [sectionsExpanded, setSectionsExpanded] = useState({
    inProgress: true,
    completed: true
  });

  // Modal para crear nueva tarea
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    priority: 'High',
    startTime: '8:00 PM',
    endTime: '8:30 PM',
    date: todayKey,
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Ordenamiento y filtro de prioridad
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [filterPriority, setFilterPriority] = useState('all'); // 'all' | 'High' | 'Medium' | 'Low'

  // Persistir en LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Error guardando tareas localmente:', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      if (selectedTaskId) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_ID, selectedTaskId);
      }
    } catch (e) {
      console.warn('Error guardando ID seleccionado:', e);
    }
  }, [selectedTaskId]);

  // Manejo de eventos de red
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Supabase Auth listener
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

  // Cargar tareas de Supabase
  const loadTasksFromSupabase = useCallback(async (userId) => {
    if (!navigator.onLine) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped = data.map(t => ({
          id: t.id,
          title: t.title,
          completed: Boolean(t.completed),
          priority: t.priority || 'Medium',
          start_time: t.start_time || '8:00 PM',
          end_time: t.end_time || '8:30 PM',
          description: t.description || '',
          comments_count: t.comments_count || 0,
          task_date: t.task_date || (t.created_at ? t.created_at.slice(0, 10) : todayKey)
        }));
        setTasks(mapped);
        if (!mapped.some(t => t.id === selectedTaskId)) {
          setSelectedTaskId(mapped[0].id);
        }
      }
    } catch (err) {
      console.warn('Usando almacenamiento local para tareas:', err);
    }
  }, [selectedTaskId, todayKey]);

  useEffect(() => {
    if (session?.user?.id) {
      loadTasksFromSupabase(session.user.id);
    }
  }, [session, loadTasksFromSupabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTasks(DEFAULT_TASKS);
    setSelectedTaskId(DEFAULT_TASKS[0].id);
    setShowMobileDetail(false);
  };

  // Tarea actualmente seleccionada
  const selectedTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || tasks[0] || null;
  }, [tasks, selectedTaskId]);

  // Alternar completado
  const toggleTaskCompleted = async (taskId, e) => {
    if (e) e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;
    const updated = tasks.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t);
    setTasks(updated);

    if (navigator.onLine && session?.user?.id) {
      try {
        await supabase.from('tasks').update({ completed: newCompleted }).eq('id', taskId);
      } catch (err) {
        console.warn('Error sincronizando completado con Supabase:', err);
      }
    }
  };

  // Cambiar prioridad de tarea
  const changeTaskPriority = async (taskId, newPriority) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, priority: newPriority } : t);
    setTasks(updated);

    if (navigator.onLine && session?.user?.id) {
      try {
        await supabase.from('tasks').update({ priority: newPriority }).eq('id', taskId);
      } catch (err) {
        console.warn('Error actualizando prioridad:', err);
      }
    }
  };

  // Cambiar estado desde el panel Detail
  const toggleStatusFromDetail = () => {
    if (!selectedTask) return;
    toggleTaskCompleted(selectedTask.id);
  };

  // Actualizar descripción
  const updateTaskDescription = async (newDesc) => {
    if (!selectedTask) return;
    const updated = tasks.map(t => t.id === selectedTask.id ? { ...t, description: newDesc } : t);
    setTasks(updated);

    if (navigator.onLine && session?.user?.id) {
      try {
        await supabase.from('tasks').update({ description: newDesc }).eq('id', selectedTask.id);
      } catch (err) {
        console.warn('Error actualizando descripción:', err);
      }
    }
  };

  // Eliminar tarea
  const deleteTask = async (taskId, e) => {
    if (e) e.stopPropagation();
    const remaining = tasks.filter(t => t.id !== taskId);
    setTasks(remaining);
    if (selectedTaskId === taskId) {
      if (remaining.length > 0) {
        setSelectedTaskId(remaining[0].id);
      } else {
        setSelectedTaskId(null);
      }
      setShowMobileDetail(false);
    }

    if (navigator.onLine && session?.user?.id) {
      try {
        await supabase.from('tasks').delete().eq('id', taskId);
      } catch (err) {
        console.warn('Error eliminando tarea de Supabase:', err);
      }
    }
  };

  // Crear nueva tarea
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskForm.title.trim()) return;

    try {
      setSubmitting(true);
      const tempId = 't-' + Date.now();
      const taskDate = newTaskForm.date || selectedDateKey || todayKey;
      const newTask = {
        id: tempId,
        title: newTaskForm.title.trim(),
        completed: false,
        priority: newTaskForm.priority,
        start_time: newTaskForm.startTime,
        end_time: newTaskForm.endTime,
        task_date: taskDate,
        description: newTaskForm.description.trim() || 'Sin descripción adicional.',
        comments_count: 0
      };

      const updated = [newTask, ...tasks];
      setTasks(updated);
      setSelectedTaskId(tempId);
      setShowMobileDetail(true);
      setIsNewTaskModalOpen(false);
      setNewTaskForm({
        title: '',
        priority: 'High',
        startTime: '8:00 PM',
        endTime: '8:30 PM',
        date: taskDate,
        description: ''
      });

      if (navigator.onLine && session?.user?.id) {
        const payload = {
          title: newTask.title,
          completed: false,
          priority: newTask.priority,
          start_time: newTask.start_time,
          end_time: newTask.end_time,
          description: newTask.description,
          task_date: newTask.task_date,
          user_id: session.user.id
        };

        const { data, error } = await supabase.from('tasks').insert([payload]).select().single();

        if (data && !error) {
          setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id } : t));
          setSelectedTaskId(data.id);
        } else if (error) {
          // Si el campo task_date no existe en Supabase todavía, reintentar sin task_date
          if (error.message && error.message.includes('task_date')) {
            delete payload.task_date;
            const retry = await supabase.from('tasks').insert([payload]).select().single();
            if (retry.data) {
              setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: retry.data.id } : t));
              setSelectedTaskId(retry.data.id);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error creando tarea:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================================
  // LÓGICA DEL CALENDARIO SEMANAL
  // ====================================================================
  // Calcular días de la semana (DOM - SAB) para la fecha de anclaje (weekAnchorDate)
  const weekDays = useMemo(() => {
    const labels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const current = new Date(weekAnchorDate);
    const dayOfWeek = current.getDay(); // 0 a 6 (0 = SUN)

    const sunday = new Date(current);
    sunday.setDate(current.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    return labels.map((label, idx) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + idx);
      const dKey = formatDateKey(d);
      return {
        label,
        dateObj: d,
        dateNum: d.getDate(),
        dateKey: dKey,
        dayOfWeekIndex: idx,
        isToday: dKey === todayKey,
        isSelected: dKey === selectedDateKey
      };
    });
  }, [weekAnchorDate, todayKey, selectedDateKey]);

  // Etiqueta del mes para la cabecera del calendario
  const calendarMonthLabel = useMemo(() => {
    if (weekDays.length < 4) return '';
    const midDay = weekDays[3].dateObj;
    return `${midDay.toLocaleString('en-US', { month: 'short' })} ${midDay.getFullYear()}`;
  }, [weekDays]);

  // Contadores de tareas por fecha para mostrar indicadores visuales
  const tasksCountByDate = useMemo(() => {
    const counts = {};
    tasks.forEach(t => {
      const key = t.task_date || todayKey;
      if (!counts[key]) counts[key] = { total: 0, pending: 0, completed: 0 };
      counts[key].total += 1;
      if (t.completed) counts[key].completed += 1;
      else counts[key].pending += 1;
    });
    return counts;
  }, [tasks, todayKey]);

  // Navegación de semanas
  const goToPreviousWeek = () => {
    setWeekAnchorDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setWeekAnchorDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setWeekAnchorDate(now);
    setDateFilterMode('selected');
    setIsMonthPickerOpen(false);
  };

  const selectMonth = (monthIndex) => {
    const current = new Date(weekAnchorDate);
    current.setMonth(monthIndex);
    setWeekAnchorDate(current);
    setSelectedDate(current);
    setIsMonthPickerOpen(false);
  };

  // Filtrado y ordenamiento de tareas
  const processedTasks = useMemo(() => {
    let list = [...tasks];

    // Filtro por fecha activa
    if (dateFilterMode === 'selected') {
      list = list.filter(t => (t.task_date || todayKey) === selectedDateKey);
    }

    // Filtro por prioridad
    if (filterPriority !== 'all') {
      list = list.filter(t => t.priority === filterPriority);
    }

    // Orden
    if (sortOrder === 'asc') {
      list.reverse();
    }

    return list;
  }, [tasks, dateFilterMode, selectedDateKey, todayKey, filterPriority, sortOrder]);

  const inProgressTasks = useMemo(() => processedTasks.filter(t => !t.completed), [processedTasks]);
  const completedTasks = useMemo(() => processedTasks.filter(t => t.completed), [processedTasks]);

  // Buscar tarea por título
  const handleSearchPrompt = () => {
    const q = prompt('Buscar tarea por título:');
    if (q) {
      const found = tasks.find(t => t.title.toLowerCase().includes(q.toLowerCase()));
      if (found) {
        setSelectedTaskId(found.id);
        setShowMobileDetail(true);
        if (found.task_date) {
          const parts = found.task_date.split('-');
          if (parts.length === 3) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            setSelectedDate(d);
            setWeekAnchorDate(d);
          }
        }
      } else {
        alert('No se encontraron tareas con ese término.');
      }
    }
  };

  // Si está cargando auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex flex-col items-center justify-center text-white gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
        <p className="text-xs text-neutral-400 tracking-wide">Cargando Mi Día...</p>
      </div>
    );
  }

  // Si no hay sesión, mostrar pantalla de Auth
  if (!session) {
    return <Auth />;
  }

  return (
    <div className="h-[100dvh] w-full bg-[#0a0a0c] text-neutral-100 font-sans p-0 sm:p-4 lg:p-6 flex items-center justify-center selection:bg-[#2563eb] selection:text-white overflow-hidden">
      
      {/* Contenedor Principal: Responsivo móvil (flex-col) / Foldable o Escritorio (flex-row) */}
      <div className="w-full max-w-7xl h-full sm:h-[94vh] max-h-[960px] bg-[#0f0f11] sm:rounded-[44px] p-2 sm:p-4 border-0 sm:border border-white/[0.07] shadow-2xl shadow-black flex flex-col sm:flex-row gap-2 sm:gap-3 relative overflow-hidden">
        
        {/* ==================================================================== */}
        {/* PANEL IZQUIERDO: MASTER (Lista de Tareas)                           */}
        {/* ==================================================================== */}
        <div className={`
          flex-1 lg:max-w-[46%] xl:max-w-[44%] bg-[#131418] rounded-2xl sm:rounded-[36px] 
          p-4 sm:p-6 border border-white/[0.04] shadow-inner flex flex-col min-h-0 overflow-hidden transition-all duration-300
          ${showMobileDetail ? 'hidden sm:flex' : 'flex'}
        `}>
          
          {/* Cabecera Master */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Tasks
              </h1>
              {dateFilterMode === 'selected' && (
                <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  {selectedDateKey === todayKey ? 'Hoy' : formatFriendlyDate(selectedDate)}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Botón Ordenar */}
              <button 
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                title="Ordenar tareas"
                className="w-9 h-9 rounded-full bg-[#1b1d24] border border-white/5 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-[#23252e] transition cursor-pointer"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>

              {/* Botón Filtro Prioridad */}
              <button 
                onClick={() => {
                  const cycle = ['all', 'High', 'Medium', 'Low'];
                  const nextIdx = (cycle.indexOf(filterPriority) + 1) % cycle.length;
                  setFilterPriority(cycle[nextIdx]);
                }}
                title={`Filtro actual: ${filterPriority}`}
                className={`w-9 h-9 rounded-full border border-white/5 flex items-center justify-center transition cursor-pointer ${
                  filterPriority !== 'all' ? 'bg-[#2563eb] text-white' : 'bg-[#1b1d24] text-neutral-300 hover:text-white hover:bg-[#23252e]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Selector de Fecha y Calendario Semanal Horizontal Interactivo */}
          <div className="mb-4 bg-[#16171d]/90 border border-white/[0.04] rounded-2xl p-3 sm:p-3.5 flex-shrink-0">
            
            {/* Fila superior: Mes/Año + Controles de Semana + Botón Hoy + Offline */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMonthPickerOpen(prev => !prev)}
                  className="flex items-center gap-1.5 text-xs font-bold text-white hover:text-blue-400 transition cursor-pointer"
                  title="Cambiar mes"
                >
                  <span>{calendarMonthLabel}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Flechas para navegar semanas */}
                <div className="flex items-center gap-0.5 bg-[#1c1d25] rounded-lg p-0.5 border border-white/5">
                  <button
                    onClick={goToPreviousWeek}
                    title="Semana anterior"
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-white/5 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={goToNextWeek}
                    title="Semana siguiente"
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-white/5 transition cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Botón rápido "Hoy" si estamos en otra fecha */}
                {selectedDateKey !== todayKey && (
                  <button
                    onClick={goToToday}
                    className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-full transition cursor-pointer"
                  >
                    Hoy
                  </button>
                )}
              </div>

              {/* Indicador de Red */}
              {!isOnline && (
                <span className="text-[10px] text-amber-400 font-medium bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" /> Offline
                </span>
              )}
            </div>

            {/* Selector Desplegable de Mes (cuando está abierto) */}
            {isMonthPickerOpen && (
              <div className="mb-3 p-3 bg-[#131419] rounded-xl border border-white/10 grid grid-cols-4 gap-1.5 animate-in fade-in duration-150">
                {MONTHS_LIST.map((m, idx) => (
                  <button
                    key={m}
                    onClick={() => selectMonth(idx)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      selectedDate.getMonth() === idx 
                        ? 'bg-[#2563eb] text-white font-bold' 
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {/* Días de la semana (DOM - SAB) con día seleccionado en círculo azul brillante e indicadores */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekDays.map(item => {
                const isSelected = item.isSelected;
                const count = tasksCountByDate[item.dateKey]?.total || 0;
                const hasPending = tasksCountByDate[item.dateKey]?.pending > 0;

                return (
                  <button
                    key={item.dateKey}
                    onClick={() => {
                      setSelectedDate(item.dateObj);
                      setDateFilterMode('selected');
                    }}
                    className="flex flex-col items-center gap-1 py-1 group transition cursor-pointer"
                  >
                    <span className={`text-[10px] font-semibold tracking-wider transition ${
                      item.isToday ? 'text-blue-400' : 'text-neutral-500 group-hover:text-neutral-300'
                    }`}>
                      {item.label}
                    </span>

                    <span className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all relative
                      ${isSelected 
                        ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-500/40 scale-105 ring-2 ring-blue-400/30' 
                        : item.isToday
                          ? 'border border-blue-500/50 text-white hover:bg-[#21232c]'
                          : 'text-neutral-300 hover:bg-[#21232c] hover:text-white'
                      }
                    `}>
                      {item.dateNum}
                    </span>

                    {/* Indicador de tareas en este día */}
                    <div className="h-1 flex items-center justify-center gap-0.5 mt-0.5">
                      {count > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : hasPending ? 'bg-[#34d399]' : 'bg-neutral-600'
                        }`}></span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de Filtro de Fecha Activa */}
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-3 px-1 flex-shrink-0">
            <span className="text-[11px] text-neutral-400 font-medium">
              {dateFilterMode === 'selected' 
                ? (selectedDateKey === todayKey ? 'Tareas de Hoy' : `Tareas de ${formatFriendlyDate(selectedDate)}`)
                : 'Todas las Tareas'
              } ({inProgressTasks.length + completedTasks.length})
            </span>

            <button
              onClick={() => setDateFilterMode(prev => prev === 'selected' ? 'all' : 'selected')}
              className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer"
            >
              {dateFilterMode === 'selected' ? 'Ver todas' : 'Ver solo este día'}
            </button>
          </div>

          {/* Lista Colapsable de Tareas (Scrollable) */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
            
            {/* Estado Vacío si no hay ninguna tarea en este día */}
            {inProgressTasks.length === 0 && completedTasks.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#17181f]/40 border border-dashed border-white/5 text-center my-4">
                <CalendarIcon className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-300 mb-1">
                  No hay tareas para {dateFilterMode === 'selected' ? (selectedDateKey === todayKey ? 'hoy' : formatFriendlyDate(selectedDate)) : 'este filtro'}
                </p>
                <p className="text-xs text-neutral-500 mb-3">
                  Organiza tu jornada programando una nueva tarea.
                </p>
                <button
                  onClick={() => {
                    setNewTaskForm(prev => ({ ...prev, date: selectedDateKey }));
                    setIsNewTaskModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear tarea para este día</span>
                </button>
              </div>
            ) : null}

            {/* SECCIÓN 1: In Progress */}
            <div>
              <button 
                onClick={() => setSectionsExpanded(p => ({ ...p, inProgress: !p.inProgress }))}
                className="w-full flex items-center justify-between text-xs font-semibold text-neutral-300 mb-2.5 hover:text-white group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-sm shadow-emerald-400/50"></span>
                  <span className="tracking-wide">In Progress</span>
                  <span className="text-[11px] text-neutral-500">({inProgressTasks.length})</span>
                </div>
                {sectionsExpanded.inProgress ? (
                  <ChevronDown className="w-4 h-4 text-neutral-500 group-hover:text-white transition" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition" />
                )}
              </button>

              {sectionsExpanded.inProgress && (
                <div className="space-y-2.5 animate-in fade-in duration-200">
                  {inProgressTasks.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-[#17181f]/40 border border-dashed border-white/5 text-center text-xs text-neutral-500">
                      No hay tareas en progreso para esta fecha.
                    </div>
                  ) : (
                    inProgressTasks.map(task => {
                      const isSelected = selectedTaskId === task.id;
                      return (
                        <div
                          key={task.id}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setShowMobileDetail(true);
                          }}
                          className={`
                            group p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative
                            ${isSelected 
                              ? 'bg-[#1a1c24] border-blue-500/40 shadow-lg shadow-black/40' 
                              : 'bg-[#16171d] border-white/[0.04] hover:bg-[#1a1c22] hover:border-white/10'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox circular (pendiente) */}
                            <button
                              type="button"
                              onClick={(e) => toggleTaskCompleted(task.id, e)}
                              className="mt-0.5 w-5 h-5 rounded-full border border-neutral-600 group-hover:border-neutral-400 flex items-center justify-center transition flex-shrink-0 cursor-pointer"
                            >
                              <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-neutral-600 transition"></div>
                            </button>

                            {/* Contenido */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-white leading-snug mb-1.5 break-words">
                                {task.title}
                              </h3>

                              {/* Fila 1: Hora y Fecha */}
                              <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1 flex-wrap">
                                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{task.start_time}{task.end_time ? ` - ${task.end_time}` : ''}</span>
                                {task.task_date && dateFilterMode === 'all' && (
                                  <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md ml-1 font-medium">
                                    {formatDetailDate(task.task_date)}
                                  </span>
                                )}
                              </div>

                              {/* Fila 2: Prioridad y Comentarios */}
                              <div className="flex items-center gap-3 text-xs">
                                <div className="flex items-center gap-1">
                                  <Flag className={`w-3.5 h-3.5 ${
                                    task.priority === 'High' ? 'text-red-500' : 
                                    task.priority === 'Medium' ? 'text-amber-400' : 'text-blue-400'
                                  }`} />
                                  <span className="text-[11px] text-neutral-400 font-medium">
                                    {task.priority} Priority
                                  </span>
                                </div>

                                {task.comments_count > 0 && (
                                  <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{task.comments_count}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: Completed */}
            <div>
              <button 
                onClick={() => setSectionsExpanded(p => ({ ...p, completed: !p.completed }))}
                className="w-full flex items-center justify-between text-xs font-semibold text-neutral-300 mb-2.5 hover:text-white group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-sm shadow-emerald-400/50"></span>
                  <span className="tracking-wide">Completed</span>
                  <span className="text-[11px] text-neutral-500">({completedTasks.length})</span>
                </div>
                {sectionsExpanded.completed ? (
                  <ChevronDown className="w-4 h-4 text-neutral-500 group-hover:text-white transition" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition" />
                )}
              </button>

              {sectionsExpanded.completed && (
                <div className="space-y-2.5 animate-in fade-in duration-200">
                  {completedTasks.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-[#17181f]/40 border border-dashed border-white/5 text-center text-xs text-neutral-500">
                      No hay tareas completadas aún en esta fecha.
                    </div>
                  ) : (
                    completedTasks.map(task => {
                      const isSelected = selectedTaskId === task.id;
                      return (
                        <div
                          key={task.id}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setShowMobileDetail(true);
                          }}
                          className={`
                            group p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer opacity-75 hover:opacity-100
                            ${isSelected 
                              ? 'bg-[#1a1c24] border-blue-500/40 shadow-lg shadow-black/40' 
                              : 'bg-[#16171d] border-white/[0.04] hover:bg-[#1a1c22]'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox circular azul con palomita */}
                            <button
                              type="button"
                              onClick={(e) => toggleTaskCompleted(task.id, e)}
                              className="mt-0.5 w-5 h-5 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-sm shadow-blue-500/40 flex-shrink-0 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-neutral-300 line-through leading-snug mb-1 break-words">
                                {task.title}
                              </h3>
                              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{task.start_time}</span>
                                {task.task_date && dateFilterMode === 'all' && (
                                  <span className="text-[10px] text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded-md ml-1">
                                    {formatDetailDate(task.task_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ==================================================================== */}
        {/* PANEL DERECHO: DETAIL (Detalle de la Tarea)                          */}
        {/* ==================================================================== */}
        <div className={`
          flex-1 bg-[#131418] rounded-2xl sm:rounded-[36px] 
          p-4 sm:p-6 border border-white/[0.04] shadow-inner flex flex-col min-h-0 overflow-hidden transition-all duration-300
          ${showMobileDetail ? 'flex' : 'hidden sm:flex'}
        `}>
          
          {selectedTask ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
              
              {/* Botón Volver a la lista en Celular */}
              <div className="sm:hidden flex items-center justify-between mb-4 flex-shrink-0">
                <button
                  onClick={() => setShowMobileDetail(false)}
                  className="flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Tareas</span>
                </button>
                <span className="text-xs text-neutral-500 font-medium">Detalles</span>
              </div>

              {/* Cabecera del Detalle: Título editable y botón de eliminar */}
              <div className="flex items-start justify-between gap-4 mb-3 flex-shrink-0">
                <input
                  type="text"
                  value={selectedTask.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, title: val } : t));
                  }}
                  onBlur={async (e) => {
                    if (navigator.onLine && session?.user?.id) {
                      await supabase.from('tasks').update({ title: e.target.value }).eq('id', selectedTask.id);
                    }
                  }}
                  className="text-xl sm:text-2xl font-bold text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-blue-500 focus:outline-none w-full tracking-tight transition"
                />

                <button
                  onClick={(e) => deleteTask(selectedTask.id, e)}
                  title="Eliminar tarea"
                  className="p-2 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition flex-shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Pestañas: Details | Activity log */}
              <div className="flex items-center gap-6 border-b border-white/[0.06] mb-5 flex-shrink-0">
                <button
                  onClick={() => setActiveDetailTab('details')}
                  className={`pb-2.5 text-sm font-semibold transition relative cursor-pointer ${
                    activeDetailTab === 'details' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Details
                  {activeDetailTab === 'details' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full"></span>
                  )}
                </button>
                <button
                  onClick={() => setActiveDetailTab('activity')}
                  className={`pb-2.5 text-sm font-semibold transition relative cursor-pointer ${
                    activeDetailTab === 'activity' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Activity log
                  {activeDetailTab === 'activity' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full"></span>
                  )}
                </button>
              </div>

              {activeDetailTab === 'details' ? (
                <div className="space-y-4">
                  {/* Tarjetas de Atributos: Tres cajas apiladas */}
                  <div className="space-y-3">
                    
                    {/* Caja 1: Date & time con fecha dinámica */}
                    <div className="bg-[#1b1d24] border border-white/[0.03] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-neutral-400">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-neutral-400">Date & time</p>
                          <p className="text-sm font-semibold text-white">
                            {formatDetailDate(selectedTask.task_date)}, {selectedTask.start_time}{selectedTask.end_time ? ` - ${selectedTask.end_time}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Caja 2: Priority level con selector adaptable */}
                    <div className="bg-[#1b1d24] border border-white/[0.03] rounded-2xl p-3.5 sm:p-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                          <Flag className={`w-4 h-4 ${
                            selectedTask.priority === 'High' ? 'text-red-500' : 
                            selectedTask.priority === 'Medium' ? 'text-amber-400' : 'text-blue-400'
                          }`} />
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-neutral-400">Priority level</p>
                          <p className="text-sm font-semibold text-white">{selectedTask.priority}</p>
                        </div>
                      </div>

                      {/* Botones para alternar prioridad */}
                      <div className="flex items-center gap-1 bg-[#131418] p-1 rounded-xl border border-white/5 ml-auto sm:ml-0">
                        {['High', 'Medium', 'Low'].map(p => (
                          <button
                            key={p}
                            onClick={() => changeTaskPriority(selectedTask.id, p)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              selectedTask.priority === p 
                                ? 'bg-white text-black shadow-sm' 
                                : 'text-neutral-500 hover:text-white'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Caja 3: Status interactivo */}
                    <div 
                      onClick={toggleStatusFromDetail}
                      className="bg-[#1b1d24] border border-white/[0.03] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-[#20222a] transition group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                          <span className={`w-2.5 h-2.5 rounded-full ${selectedTask.completed ? 'bg-[#2563eb]' : 'bg-[#34d399]'}`}></span>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-neutral-400">Status</p>
                          <p className="text-sm font-semibold text-white">
                            {selectedTask.completed ? 'Completed' : 'In Progress'}
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition" />
                    </div>

                  </div>

                  {/* Sección Description */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                      <AlignLeft className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Description</span>
                    </div>

                    <div className="bg-[#1b1d24]/60 border border-white/[0.03] rounded-2xl p-3.5 sm:p-4">
                      <textarea
                        value={selectedTask.description}
                        onChange={(e) => updateTaskDescription(e.target.value)}
                        placeholder="Añade detalles adicionales para esta tarea..."
                        rows={4}
                        className="w-full bg-transparent text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none resize-none leading-relaxed"
                      />
                      <p className="text-[10px] text-neutral-500 text-right mt-1">
                        Editable en tiempo real
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Pestaña Activity Log */
                <div className="p-5 sm:p-6 bg-[#1b1d24]/40 border border-white/[0.03] rounded-2xl space-y-4">
                  <div className="flex items-start gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1"></span>
                    <div>
                      <p className="text-white font-medium">Tarea sincronizada con Supabase</p>
                      <p className="text-neutral-500">Última actualización guardada localmente y en la nube.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1"></span>
                    <div>
                      <p className="text-white font-medium">Estado actual: {selectedTask.completed ? 'Completada' : 'En Progreso'}</p>
                      <p className="text-neutral-500">Fecha asignada: {formatDetailDate(selectedTask.task_date)} • Prioridad: {selectedTask.priority}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <CheckSquare className="w-12 h-12 text-neutral-600 mb-3" />
              <p className="text-base font-semibold text-white mb-1">Selecciona una tarea</p>
              <p className="text-xs text-neutral-500">Elige una tarea de la lista para ver y editar sus detalles completos.</p>
            </div>
          )}

          {/* Footer de información de usuario */}
          <div className="pt-3 mt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-neutral-500 flex-shrink-0">
            <span className="truncate max-w-[180px] sm:max-w-[220px]">{session?.user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-neutral-400 hover:text-rose-400 transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>

        </div>

        {/* ==================================================================== */}
        {/* BARRA DE NAVEGACIÓN: Inferior en móvil / Lateral vertical en desktop  */}
        {/* ==================================================================== */}
        <nav className="
          w-full sm:w-14 
          h-14 sm:h-full 
          bg-[#131419]/95 sm:bg-[#14151a] 
          backdrop-blur-md 
          border border-white/[0.06] 
          rounded-2xl sm:rounded-full 
          px-5 sm:px-0 py-2 sm:py-4 
          flex flex-row sm:flex-col 
          items-center justify-between 
          shadow-2xl flex-shrink-0 z-20
        ">
          
          {/* Iconos de Navegación */}
          <div className="flex flex-row sm:flex-col items-center gap-7 sm:gap-5">
            <button 
              onClick={() => {
                goToToday();
                setShowMobileDetail(false);
              }}
              title="Inicio / Hoy"
              className="p-1.5 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <Home className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowMobileDetail(false)}
              title="Tareas"
              className={`p-1.5 rounded-xl transition cursor-pointer ${
                !showMobileDetail ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <CheckSquare className="w-5 h-5" />
            </button>

            <button 
              onClick={handleSearchPrompt}
              title="Buscar tarea"
              className="p-1.5 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          {/* FAB circular azul brillante con el símbolo "+" para crear tareas */}
          <button
            onClick={() => {
              setNewTaskForm(prev => ({
                ...prev,
                date: selectedDateKey
              }));
              setIsNewTaskModalOpen(true);
            }}
            title="Crear nueva tarea"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center font-bold shadow-lg shadow-blue-600/40 transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
          </button>
        </nav>

      </div>

      {/* ==================================================================== */}
      {/* MODAL: CREAR NUEVA TAREA                                            */}
      {/* ==================================================================== */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#16171d] border border-white/10 rounded-[32px] max-w-md w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white tracking-tight">Nueva Tarea</h3>
              <button 
                onClick={() => setIsNewTaskModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Título de la tarea
                </label>
                <input
                  type="text"
                  placeholder="ej. Client meeting with Burger King"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                  className="w-full bg-[#1b1d24] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>

              {/* Fecha de la tarea */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Fecha asignada
                </label>
                <input
                  type="date"
                  value={newTaskForm.date}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, date: e.target.value })}
                  className="w-full bg-[#1b1d24] border border-white/5 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Horas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Inicio
                  </label>
                  <input
                    type="text"
                    placeholder="8:00 PM"
                    value={newTaskForm.startTime}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, startTime: e.target.value })}
                    className="w-full bg-[#1b1d24] border border-white/5 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Fin
                  </label>
                  <input
                    type="text"
                    placeholder="8:30 PM"
                    value={newTaskForm.endTime}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, endTime: e.target.value })}
                    className="w-full bg-[#1b1d24] border border-white/5 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Selector de Prioridad */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Prioridad
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['High', 'Medium', 'Low'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTaskForm({ ...newTaskForm, priority: p })}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        newTaskForm.priority === p 
                          ? 'bg-[#2563eb] text-white border-blue-400/50 shadow-md shadow-blue-500/20' 
                          : 'bg-[#1b1d24] text-neutral-400 border-white/5 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Descripción
                </label>
                <textarea
                  placeholder="Detalles sobre los objetivos o temas a tratar..."
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-[#1b1d24] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTaskForm.title.trim()}
                  className="px-5 py-2.5 text-sm font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creando...' : 'Crear Tarea'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
