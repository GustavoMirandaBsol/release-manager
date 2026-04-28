// src/pages/Login.jsx
import { useState } from "react";
import { importFromExcel, isSupabaseBackendEnabled } from "../services/localExcelService";
import { signInWithEmail } from "../services/authService";

export default function Login({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleStartLocalMode = () => {
    setError(null);
    onLoginSuccess();
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Ingresa un correo electrónico.");
      return;
    }

    setLoading(true);
    setError(null);
    setMagicLinkSent(false);
    try {
      await signInWithEmail(email.trim());
      setMagicLinkSent(true);
    } catch (err) {
      setError(`Error al enviar el enlace de acceso: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      await importFromExcel(file);
      onLoginSuccess();
    } catch (err) {
      setError(`Error al importar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-mark large">RC</div>
        </div>
        <h1 className="login-title">Release Candidate<br />Manager</h1>
        <p className="login-subtitle">
          {isSupabaseBackendEnabled
            ? "Gestión compartida de releases y funcionalidades"
            : "Gestión de releases y funcionalidades en Excel local"}
        </p>

        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">DB</span>
            <span>
              {isSupabaseBackendEnabled
                ? "Base de datos compartida con Supabase"
                : "Almacenamiento local (sin servidor)"}
            </span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔍</span>
            <span>Búsqueda y filtrado avanzado</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">ID</span>
            <span>Acceso por correo y auditoría de usuarios</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📥</span>
            <span>Importa/Exporta archivos Excel</span>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠ {error}</span>
          </div>
        )}

        {magicLinkSent && (
          <div className="alert alert-success">
            <span>✓ Revisa tu correo y abre el enlace de acceso.</span>
          </div>
        )}

        {isSupabaseBackendEnabled ? (
          <form className="login-form" onSubmit={handleEmailLogin}>
            <input
              className="login-input"
              type="email"
              placeholder="correo@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <button className="btn-ms-login" type="submit" disabled={loading}>
              <span className="google-mark">@</span>
              {loading ? "Enviando..." : "Enviar enlace de acceso"}
            </button>
          </form>
        ) : (
          <button
            className="btn-ms-login"
            onClick={handleStartLocalMode}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            {loading ? "Iniciando..." : "Iniciar en modo local"}
          </button>
        )}

        {!isSupabaseBackendEnabled && (
          <>
            <div className="divider">O importa un archivo</div>

            <label className="btn-import">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Importar Excel (.xlsx)
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
                disabled={loading}
                style={{ display: "none" }}
              />
            </label>
          </>
        )}

        <p className="login-footer">
          {isSupabaseBackendEnabled
            ? "Los datos se guardan en la base compartida del proyecto"
            : "Todos los datos se guardan localmente en tu navegador"}
        </p>
      </div>
    </div>
  );
}
