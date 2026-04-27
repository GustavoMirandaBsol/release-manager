# Release Candidate Manager

Aplicación React + Vite para registrar, importar, editar, filtrar y exportar releases.

La app puede trabajar en dos modos:

- **Supabase compartido**: todos los usuarios ven y editan la misma información.
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

El SQL incluido permite lectura, creación, edición y borrado público usando la anon key. Esto es práctico para un MVP interno con enlace compartido, pero cualquier persona con acceso a la app podría modificar registros.

Para un uso más controlado, conviene agregar autenticación y políticas RLS por usuario o dominio.

