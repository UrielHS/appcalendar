# 📅 Mi Día - Planificador Diario & Calendario (PWA)

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel&logoColor=white)](https://vercel.com/)

**Mi Día** es una aplicación web progresiva (**PWA**) de gestión del tiempo y planificación de tareas diarias con arquitectura **Master-Detail**, modo oscuro estricto inspirado en interfaces para dispositivos plegables/tablets y adaptabilidad responsiva con barra de navegación nativa para teléfonos inteligentes.

Cuenta con soporte **Offline-First** (sin conexión a internet mediante Service Workers y LocalStorage) y sincronización automática en la nube con **Supabase** (autenticación y base de datos relacional PostgreSQL con RLS).

---

## 🌟 Características Principales

### 📱 Diseño y Experiencia de Usuario (UI/UX)
- **Patrón Maestro-Detalle (Master-Detail)**: 
  - **Pantallas grandes (Tablets / Foldables desplegados / Escritorio)**: Lista de tareas en el panel izquierdo y visor/editor completo en el panel derecho, acompañados de una barra de navegación vertical en el extremo derecho.
  - **Teléfonos celulares**: Interfaz a pantalla completa con navegación fluida entre la lista y los detalles mediante el botón superior y una barra de navegación inferior horizontal accesible para el pulgar.
- **Tema Oscuro Estricto**: Paleta de colores en grises muy oscuros (`#0a0a0c` y `#0f0f11`), bordes sutiles y acentos azul eléctrico (`#2563eb`) y verde esmeralda (`#34d399`).

### 📅 Calendario Semanal Interactivo
- **Navegación de Semanas**: Flechas `<` y `>` para explorar semanas pasadas y futuras.
- **Selector de Mes**: Menú desplegable para saltar de forma inmediata a cualquier mes del año.
- **Botón "Hoy"**: Acceso directo para regresar a la fecha actual con un solo clic.
- **Filtrado Dinámico de Tareas**: Selecciona cualquier día (de Domingo a Sábado) para visualizar y gestionar únicamente las tareas programadas para esa fecha.
- **Indicadores de Actividad**: Puntos visuales debajo de cada día que señalan la existencia de tareas pendientes o completadas.
- **Alternador de Vista**: Cambio rápido entre *"Ver solo este día"* y *"Ver todas las tareas"*.

### ⚡ Offline-First y PWA
- **Instalable como App**: Manifiesto web (`manifest.webmanifest`) configurable para instalarse como aplicación nativa en Android, iOS, Windows y macOS.
- **Acceso Sin Conexión**: Service Worker configurado con Workbox que realiza precacheo de recursos estáticos.
- **Persistencia Local**: Los datos se almacenan en `localStorage` de forma inmediata ante cualquier cambio, permitiendo crear, editar, marcar y organizar tareas aún sin red Wi-Fi o datos móviles.
- **Detección de Red**: Indicador visual automático de estado de conexión (*Offline*).

### 🔒 Backend y Seguridad con Supabase
- **Autenticación Completa**: Registro e inicio de sesión por correo electrónico y contraseña.
- **Row Level Security (RLS)**: Políticas activas en PostgreSQL que aseguran que cada usuario acceda únicamente a sus propias tareas y proyectos.
- **Sincronización Transparente**: Sincroniza automáticamente los datos locales con la nube en cuanto se restablece la conexión a internet.

---

## 🛠️ Tecnologías Utilizadas

| Categoría | Tecnología |
| :--- | :--- |
| **Frontend** | React 18, Vite 6 |
| **Estilos** | Tailwind CSS 3, PostCSS, Autoprefixer |
| **Iconografía** | Lucide React |
| **PWA & Offline** | Vite Plugin PWA, Workbox |
| **Backend & Base de Datos** | Supabase (PostgreSQL, GoTrue Auth) |
| **Hosting & CI/CD** | Vercel (despliegue continuo con GitHub) |

---

## 🚀 Instalación y Puesta en Marcha Local

### Prerrequisitos
- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- Gestor de paquetes `npm`

### Pasos

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/UrielHS/appcalendar.git
   cd appcalendar
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar las variables de entorno**:
   Copia el archivo de ejemplo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` y coloca las credenciales de tu proyecto de Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
   ```

4. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:5173`.

5. **Compilar para producción**:
   ```bash
   npm run build
   ```

---

## 🗄️ Configuración de la Base de Datos (Supabase)

El repositorio incluye el archivo [`supabase_schema.sql`](supabase_schema.sql) con la estructura completa de tablas, triggers y políticas de seguridad RLS.

Para configurarlo:
1. Dirígete a tu panel de **[Supabase](https://supabase.com)**.
2. Abre la sección **SQL Editor**.
3. Pega y ejecuta el contenido de [`supabase_schema.sql`](supabase_schema.sql).

Las columnas principales de la tabla `tasks` son:
- `id` (UUID, clave primaria)
- `user_id` (UUID, referencia al usuario en `auth.users`)
- `title` (TEXT, título de la tarea)
- `completed` (BOOLEAN, estado de la tarea)
- `priority` (TEXT: `'High'`, `'Medium'`, `'Low'`)
- `task_date` (DATE, fecha asignada a la tarea)
- `start_time` (TEXT, hora de inicio ej. `'8:00 PM'`)
- `end_time` (TEXT, hora de fin ej. `'8:30 PM'`)
- `description` (TEXT, notas o descripción ampliada)
- `comments_count` (INTEGER, contador de comentarios)

---

## 📂 Estructura del Proyecto

```text
├── public/                 # Iconos, favicon y assets estáticos del PWA
│   ├── favicon.ico
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── components/
│   │   └── Auth.jsx        # Pantalla de inicio de sesión y registro
│   ├── App.jsx             # Componente central (Master-Detail, Calendario, Tareas)
│   ├── index.css           # Estilos base y directivas de Tailwind CSS
│   ├── main.jsx            # Punto de entrada de React y registro del PWA
│   └── supabaseClient.js   # Inicialización y saneamiento del cliente Supabase
├── .env.example            # Plantilla de variables de entorno requeridas
├── index.html              # HTML base con meta tags para PWA
├── package.json            # Scripts y dependencias del proyecto
├── supabase_schema.sql     # Script SQL con esquemas, RLS y triggers
├── tailwind.config.js      # Configuración de diseño y colores de Tailwind
├── vercel.json             # Reglas de reescritura para Single Page Application (SPA)
└── vite.config.js          # Configuración de Vite y del plugin VitePWA
```

---

## 🌐 Despliegue en Vercel

El proyecto está listo para desplegarse en **[Vercel](https://vercel.com)**:
1. Conecta el repositorio de GitHub (`UrielHS/appcalendar`) en tu panel de Vercel.
2. Agrega las Variables de Entorno en los ajustes del proyecto (*Settings -> Environment Variables*):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Cada vez que realices un `git push` a la rama `main`, Vercel compilará y desplegará la versión más reciente automáticamente.

---

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia [MIT](LICENSE).
