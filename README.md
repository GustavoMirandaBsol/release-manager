# Release Candidate Manager

Aplicación React + Vite para registrar, importar, editar, filtrar y exportar releases.

La app puede trabajar en dos modos:

- **Supabase compartido con Google**: los usuarios inician sesión con Google, todos ven la misma información y la base guarda quién accede/crea/edita.
- **Local**: si no hay variables de Supabase, usa `localStorage` del navegador.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**.
3. Ejecuta el script:

```text
supabase/schema.sql
```

4. En Supabase ve a **Project Settings** -> **API** y copia:
   - Project URL
   - anon public key

5. Para desarrollo local, crea `.env.local`:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

6. Para GitHub Pages, agrega estos secrets en:

`Settings` -> `Secrets and variables` -> `Actions`

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Al hacer push a `main`, GitHub Actions compila la app con esos secrets.

## Configurar Login Con Google

En Supabase:

1. Ve a `Authentication` -> `Providers`.
2. Activa `Google`.
3. Configura el Client ID y Client Secret de Google Cloud.
4. En `Authentication` -> `URL Configuration`:
   - `Site URL`: `https://gustavomirandabsol.github.io/release-manager/`
   - `Redirect URLs`:
     - `https://gustavomirandabsol.github.io/release-manager/`
     - `http://localhost:5173/`

En Google Cloud, el redirect autorizado del OAuth Client debe ser el callback de Supabase:

```text
https://TU_PROYECTO.supabase.co/auth/v1/callback
```

## Consultar Accesos Y Auditoria

Usuarios que accedieron al portal:

```sql
select email, full_name, provider, action, accessed_at
from public.portal_access_logs
order by accessed_at desc;
```

Registros con usuario creador/editor:

```sql
select
  release,
  proyecto,
  created_by_email,
  updated_by_email,
  created_at,
  updated_at
from public.release_records
order by id desc;
```

## Desarrollo Local

```bash
npm install
npm run dev
```

Abre:

```text
http://localhost:5173
```

## Publicar En GitHub Pages

El proyecto ya incluye `.github/workflows/deploy.yml`.

En GitHub:

1. Ve a `Settings` -> `Pages`.
2. En `Build and deployment`, selecciona `GitHub Actions`.
3. Haz push a `main`.

La app se publicará en:

```text
https://gustavomirandabsol.github.io/release-manager/
```

## Columnas Del Registro

La app trabaja con estos campos:

| Campo |
|---|
| Release |
| Proyecto |
| Flujo |
| en Base a |
| Funcionalidades |
| Pase a producción |
| Fecha de Pase |
| Activo |

## Importar Excel

El importador busca la hoja:

```text
Release y funcionalidades
```

Y reconoce los encabezados reales del archivo Excel.

## Nota De Seguridad

El SQL incluido permite lectura, creación, edición y borrado a cualquier usuario autenticado con Google en Supabase. Esto es práctico para un MVP interno con enlace compartido.

Para un uso más controlado, conviene restringir el acceso por dominio de correo, lista blanca de usuarios o roles.
