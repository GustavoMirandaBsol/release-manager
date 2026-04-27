// src/services/authConfig.js
// =====================================================================
// CONFIGURACIÓN DE AZURE AD / MICROSOFT IDENTITY
// =====================================================================
// Pasos para obtener estos valores:
// 1. Ve a https://portal.azure.com → Azure Active Directory → App registrations
// 2. Crea una nueva app o usa una existente
// 3. En "Authentication" agrega como Redirect URI: https://TU_USUARIO.github.io/TU_REPO/
// 4. En "API permissions" agrega: Sites.ReadWrite.All (Microsoft Graph)
// =====================================================================

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID || "TU_CLIENT_ID_AQUI",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || "TU_TENANT_ID_AQUI"}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["User.Read", "Sites.ReadWrite.All", "Files.ReadWrite.All"],
};

// =====================================================================
// CONFIGURACIÓN DE SHAREPOINT
// =====================================================================
// VITE_SHAREPOINT_SITE_ID: Ve a Graph Explorer → GET https://graph.microsoft.com/v1.0/sites/{tu-dominio}.sharepoint.com:/sites/{nombre-sitio}
// Copia el campo "id"
// VITE_EXCEL_FILE_ID: Ve a Graph Explorer → GET https://graph.microsoft.com/v1.0/sites/{siteId}/drive/root/children
// Busca tu archivo .xlsx y copia el campo "id"
// =====================================================================

export const sharepointConfig = {
  siteId: import.meta.env.VITE_SHAREPOINT_SITE_ID || "TU_SITE_ID_AQUI",
  fileId: import.meta.env.VITE_EXCEL_FILE_ID || "TU_FILE_ID_AQUI",
  sheetName: "Release y funcionalidades",
};
