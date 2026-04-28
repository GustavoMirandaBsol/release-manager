// src/pages/Dashboard.jsx
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import ReleaseForm from "../components/ReleaseForm";
import ReleaseTable from "../components/ReleaseTable";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  fetchReleaseData,
  exportToExcel,
  importFromExcel,
  deleteAllReleaseRows,
  isSupabaseBackendEnabled,
  checkDataBackend,
} from "../services/localExcelService";

function isYes(value) {
  return ["si", "sí", "hecho", "listo"].includes(String(value || "").trim().toLowerCase());
}

export default function Dashboard({ user, onLogout }) {
  const { call, loading } = useLocalStorage();
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState("form");
  const [editData, setEditData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [fetchError, setFetchError] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);
  const [backendChecking, setBackendChecking] = useState(false);
  const fileInputRef = useRef(null);
  const projectSummary = useMemo(() => {
    const grouped = data.reduce((acc, row) => {
      const project = row.Proyecto || "Sin proyecto";
      if (!acc[project]) {
        acc[project] = {
          project,
          total: 0,
          active: 0,
          production: 0,
          pendingProduction: 0,
          latestRelease: "",
        };
      }

      acc[project].total += 1;
      if (isYes(row.Activo)) acc[project].active += 1;
      if (isYes(row["Pase a producción"])) {
        acc[project].production += 1;
      } else {
        acc[project].pendingProduction += 1;
      }
      acc[project].latestRelease = row.Release || acc[project].latestRelease;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.total - a.total || a.project.localeCompare(b.project));
  }, [data]);

  const loadData = useCallback(async () => {
    setFetchError(null);
    try {
      const rows = await call(fetchReleaseData);
      setData(rows || []);
    } catch (err) {
      setFetchError(err.message);
    }
  }, [call]);

  useEffect(() => {
    loadData();
  }, []);

  const handleBackendCheck = useCallback(async (testWrite = false) => {
    setBackendChecking(true);
    try {
      const status = await checkDataBackend({ testWrite });
      setBackendStatus(status);
    } catch (err) {
      setBackendStatus({
        ok: false,
        message: err.message || "No se pudo validar la conexión con Supabase.",
      });
    } finally {
      setBackendChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isSupabaseBackendEnabled) {
      handleBackendCheck(false);
    }
  }, [handleBackendCheck]);

  const handleEdit = (row) => {
    setEditData(row);
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSuccess = () => {
    loadData();
    setActiveTab("tabla");
  };

  const handleExport = async () => {
    setFetchError(null);
    try {
      await call(exportToExcel);
    } catch (err) {
      setFetchError(err.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!data.length) return;

    const confirmed = confirm(
      `¿Eliminar los ${data.length} registros guardados? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setFetchError(null);
    try {
      await call(deleteAllReleaseRows);
      setData([]);
      setSearchTerm("");
      setEditData(null);
    } catch (err) {
      setFetchError(`Error al eliminar registros: ${err.message}`);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setFetchError(null);
    try {
      await importFromExcel(file);
      await loadData();
      alert("✓ Datos importados exitosamente");
    } catch (err) {
      setFetchError(`Error al importar: ${err.message}`);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="dashboard">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">RC</div>
          <div>
            <h1>Release Candidate Manager</h1>
            <p className="subtitle">
              {isSupabaseBackendEnabled
                ? "Gestión compartida con acceso por correo"
                : "Gestión de Releases y Funcionalidades (Local)"}
            </p>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <div className="user-avatar">{user?.email?.[0]?.toUpperCase() || "L"}</div>
            <div>
              <p className="user-name">
                {isSupabaseBackendEnabled ? user?.name || "Modo Compartido" : "Modo Local"}
              </p>
              <p className="user-email">
                {isSupabaseBackendEnabled ? user?.email || "Base de datos Supabase" : "Almacenamiento en navegador"}
              </p>
            </div>
          </div>
          <button className="btn-logout" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main className="main-content">
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-number">{data.length}</span>
            <span className="stat-label">Registros totales</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {data.filter((r) => isYes(r.Activo)).length}
            </span>
            <span className="stat-label stat-ok">Activos</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {data.filter((r) => isYes(r["Pase a producción"])).length}
            </span>
            <span className="stat-label stat-ok">Pase a prod.</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {data.filter((r) => !isYes(r["Pase a producción"])).length}
            </span>
            <span className="stat-label stat-warn">Pendiente pase prod.</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {[...new Set(data.map((r) => r.Proyecto).filter(Boolean))].length}
            </span>
            <span className="stat-label">Proyectos activos</span>
          </div>
        </div>

        <section className="project-dashboard">
          <div className="section-heading">
            <div>
              <h2>Resumen por proyecto</h2>
              <p>Bloques agrupados por proyecto con conteo de releases y pases a producción.</p>
            </div>
          </div>

          {projectSummary.length === 0 ? (
            <div className="project-empty">Aún no hay registros para agrupar.</div>
          ) : (
            <div className="project-grid">
              {projectSummary.map((item) => (
                <article className="project-card" key={item.project}>
                  <div className="project-card-header">
                    <h3>{item.project}</h3>
                    <span className="status-badge status-neutral">{item.active} activos</span>
                  </div>
                  <div className="project-card-metrics">
                    <div>
                      <strong>{item.total}</strong>
                      <span>Releases</span>
                    </div>
                    <div>
                      <strong>{item.production}</strong>
                      <span>Pase prod.</span>
                    </div>
                    <div>
                      <strong>{item.pendingProduction}</strong>
                      <span>Pendientes</span>
                    </div>
                  </div>
                  <p className="project-latest">{item.latestRelease || "Sin release registrado"}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="tabs">
          <button
            className={`tab ${activeTab === "form" ? "active" : ""}`}
            onClick={() => { setActiveTab("form"); setEditData(null); }}
          >
            {editData ? "✎ Editar registro" : "+ Nuevo registro"}
          </button>
          <button
            className={`tab ${activeTab === "tabla" ? "active" : ""}`}
            onClick={() => setActiveTab("tabla")}
          >
            ☰ Ver registros
            <span className="tab-count">{data.length}</span>
          </button>
          <button
            className="tab"
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
          >
            📤 {importLoading ? "Importando..." : "Importar Excel"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
          <button className="tab" onClick={handleExport}>
            📥 Exportar Excel
          </button>
        </div>

        {isSupabaseBackendEnabled && backendStatus && (
          <div className={`alert ${backendStatus.ok ? "alert-success" : "alert-error"}`}>
            <span>{backendStatus.ok ? "✓" : "⚠"} {backendStatus.message}</span>
            <button
              className="alert-action"
              onClick={() => handleBackendCheck(true)}
              disabled={backendChecking}
            >
              {backendChecking ? "Probando..." : "Probar escritura"}
            </button>
          </div>
        )}

        <div className="tab-content">
          {activeTab === "form" && (
            <div className="card">
              <div className="card-header">
                <h2>{editData ? "Editar registro" : "Nuevo release"}</h2>
                <p className="card-desc">
                  {editData
                    ? "Modifica los campos y guarda los cambios localmente."
                    : "Completa el formulario para registrar un nuevo release."}
                </p>
              </div>
              <ReleaseForm
                onSuccess={handleSuccess}
                editData={editData}
                existingData={data}
                onCancelEdit={() => setEditData(null)}
              />
            </div>
          )}

          {activeTab === "tabla" && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Registros locales</h2>
                  <p className="card-desc">Busca y filtra tus registros de Excel local.</p>
                </div>
                <div className="card-actions-row">
                  <input
                    type="text"
                    className="record-search-input"
                    placeholder="Buscar registros..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="btn-refresh" onClick={loadData} disabled={loading}>
                    {loading ? "⟳ Actualizando..." : "⟳ Actualizar"}
                  </button>
                  <button
                    className="btn-refresh btn-danger"
                    onClick={handleDeleteAll}
                    disabled={loading || importLoading || data.length === 0}
                  >
                    Eliminar todo
                  </button>
                </div>
              </div>
              {fetchError && (
                <div className="alert alert-error">
                  <span>⚠ Error al cargar: {fetchError}</span>
                </div>
              )}
              <ReleaseTable
                data={data}
                onEdit={handleEdit}
                onDelete={loadData}
                loading={loading}
                search={searchTerm}
                onSearchChange={setSearchTerm}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
