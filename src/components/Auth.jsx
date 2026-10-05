import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  UserPlus,
  LogIn
} from 'lucide-react';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Autenticación directa con Correo y Contraseña (Login / Registro sin límite de correos)
  const handleEmailPasswordAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (!isSupabaseConfigured) {
      setError('Aún no has configurado tus credenciales reales en el archivo .env.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      if (isSignUp) {
        // REGISTRO
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (signUpError) throw signUpError;

        if (data?.session) {
          setMessage('¡Cuenta creada y sesión iniciada con éxito!');
        } else if (data?.user) {
          setMessage(
            '¡Registro exitoso! Si en tu consola de Supabase está activo "Confirm email", revisa tu correo. Para entrar de inmediato sin esperar correo, desactiva "Confirm email" en Supabase > Auth > Providers > Email.'
          );
        }
      } else {
        // INICIO DE SESIÓN
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (signInError) throw signInError;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('failed to fetch')) {
        setError('Error de conexión con Supabase. Revisa que tu URL en .env sea correcta.');
      } else if (msg.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Comprueba tu correo y contraseña o crea una cuenta nueva.');
      } else if (msg.includes('User already registered')) {
        setError('Este correo ya está registrado. Selecciona "Iniciar Sesión".');
      } else {
        setError(msg || 'Error en la autenticación.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Magic Link alternativo
  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (!isSupabaseConfigured) {
      setError('Aún no has configurado tus credenciales reales en el archivo .env.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      setMessage('¡Enlace mágico enviado! Revisa tu bandeja de entrada o spam.');
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('rate limit') || msg.includes('exceeded')) {
        setError('Límite de envíos de correo excedido en Supabase. Utiliza correo y contraseña.');
      } else {
        setError(msg || 'Error al enviar el enlace mágico.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth
  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      setError('Aún no has configurado tus credenciales reales en el archivo .env.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err?.message || 'Error al autenticarse con Google.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        {/* Cabecera */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/30 mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Mi Día</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Planificador diario personal y productivo</p>
        </div>

        {/* Pestañas: Iniciar Sesión / Registrarse */}
        <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-700/60 mb-6">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); setMessage(null); }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              !isSignUp ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(null); setMessage(null); }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              isSignUp ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Registrarme
          </button>
        </div>

        {/* Alertas */}
        {message && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex gap-3 items-start">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
            <p className="leading-relaxed">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Formulario Principal (Correo + Contraseña) */}
        {!showMagicLink ? (
          <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className={`w-full flex items-center justify-center gap-2 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                isSignUp 
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30' 
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isSignUp ? 'Creando cuenta...' : 'Entrando...'}
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'Crear mi cuenta' : 'Iniciar Sesión'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Formulario Alternativo Magic Link */
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label htmlFor="magic-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Enviar enlace a tu correo
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="magic-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Enviar Magic Link</span>}
            </button>
          </form>
        )}

        {/* Separador */}
        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-slate-700 w-full"></div>
          <span className="bg-slate-800 px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold absolute">
            Opciones adicionales
          </span>
        </div>

        {/* Google OAuth & Alternativas */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-medium py-2.5 px-4 rounded-xl transition-all text-xs sm:text-sm shadow-md disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continuar con Google
          </button>

          <button
            type="button"
            onClick={() => { setShowMagicLink(!showMagicLink); setError(null); setMessage(null); }}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
          >
            {showMagicLink ? '← Volver a inicio con contraseña' : '¿Prefieres enlace mágico por correo? Haz clic aquí'}
          </button>
        </div>

      </div>
    </div>
  );
}
