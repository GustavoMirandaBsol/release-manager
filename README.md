# 🚀 Release Candidate Manager

Aplicación web para registrar y visualizar releases en el Excel de SharePoint. Construida con React + Vite, autenticación Microsoft (MSAL) y Microsoft Graph API.

---

## 📋 Características

- ✅ Login con cuenta Microsoft (OAuth MSAL)
- ✅ Registro de releases directamente en el Excel de SharePoint
- ✅ Visualización de todos los registros con filtros y búsqueda
- ✅ Edición de registros existentes
- ✅ Dashboard con estadísticas (total, riesgo alto, pendientes)
- ✅ Deploy automático a GitHub Pages

---

## ⚙️ Configuración inicial

### 1. Registrar la aplicación en Azure AD

1. Ve a [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Haz clic en **New registration**
3. Nombre: `Release Manager` (o el que prefieras)
4. En **Redirect URI**: selecciona "Single-page application (SPA)" y agrega:
   - `http://localhost:5173` (para desarrollo)
   - `https://TU_USUARIO.github.io/TU_REPO/` (para producción)
5. Guarda el **Application (client) ID** y el **Directory (tenant) ID**
6. Ve a **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated**:
   - `User.Read`
   - `Sites.ReadWrite.All`
   - `Files.ReadWrite.All`
7. Haz clic en **Grant admin consent**

### 2. Obtener el Site ID de SharePoint

Abre [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) e inicia sesión:

```
GET https://graph.microsoft.com/v1.0/sites/{tu-dominio}.sharepoint.com:/sites/{nombre-sitio}
```

Copia el campo `"id"` del resultado.

### 3. Obtener el File ID del Excel

```
GET https://graph.microsoft.com/v1.0/sites/{siteId}/drive/root/children
```

Busca el archivo `GESTIÓN_RELEASE_CANDIDATE.xlsx` y copia su `"id"`.

### 4. Configurar variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

```env
VITE_CLIENT_ID=tu-client-id
VITE_TENANT_ID=tu-tenant-id
VITE_REDIRECT_URI=http://localhost:5173
VITE_SHAREPOINT_SITE_ID=tu-site-id
VITE_EXCEL_FILE_ID=tu-file-id
```

---

## 🛠️ Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

---

## 🌐 Deploy a GitHub Pages

### Opción A: Automático con GitHub Actions (recomendado)

1. En GitHub, ve a tu repo → **Settings** → **Secrets and variables** → **Actions**
2. Agrega estos secrets:
   - `VITE_CLIENT_ID`
   - `VITE_TENANT_ID`
   - `VITE_REDIRECT_URI` → `https://TU_USUARIO.github.io/TU_REPO/`
   - `VITE_SHAREPOINT_SITE_ID`
   - `VITE_EXCEL_FILE_ID`
3. Ve a **Settings** → **Pages** → Source: **GitHub Actions**
4. Haz push a `main` y el workflow se ejecuta automáticamente

### Opción B: Manual

```bash
# Crear .env.local con los valores de producción primero
npm run build
npx gh-pages -d dist
```

---

## 📁 Estructura del proyecto

```
release-manager/
├── src/
│   ├── components/
│   │   ├── ReleaseForm.jsx     # Formulario de registro
│   │   └── ReleaseTable.jsx    # Tabla con filtros
│   ├── hooks/
│   │   └── useGraphApi.js      # Hook para llamadas a Graph API
│   ├── pages/
│   │   ├── Dashboard.jsx       # Pantalla principal
│   │   └── Login.jsx           # Pantalla de login
│   ├── services/
│   │   ├── authConfig.js       # Configuración MSAL
│   │   └── graphService.js     # Llamadas a Microsoft Graph
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .github/workflows/deploy.yml
├── .env.example
└── vite.config.js
```

---

## 🔧 Hoja de Excel esperada

La app trabaja con la hoja **"Release y funcionalidades"** que debe tener estos encabezados en la fila 1:

| Feature | Release | Proyectos | Flujos | en Base a | Funcionalidades | Pase a producción | Update a Dev | Riesgo |
|---------|---------|-----------|--------|-----------|-----------------|-------------------|--------------|--------|

---

## 📝 Notas

- Los datos del formulario se escriben directamente en el Excel de SharePoint vía Microsoft Graph API
- Se requieren permisos de administrador para hacer `Grant admin consent` en Azure AD
- El archivo `.env.local` **nunca** debe subirse a GitHub (está en `.gitignore`)
