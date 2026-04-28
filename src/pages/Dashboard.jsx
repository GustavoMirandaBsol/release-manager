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
  const [activeProjectTab, setActiveProjectTab] = useState("");
  const [showProjectSummary, setShowProjectSummary] = useState(false);
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
          releases: [],
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
      acc[project].releases.push(row);
      return acc;
    }, {});

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        releases: item.releases.slice().sort((a, b) => String(b.Release).localeCompare(String(a.Release))),
      }))
      .sort((a, b) => b.total - a.total || a.project.localeCompare(b.project));
  }, [data]);
  const selectedProject = projectSummary.find((item) => item.project === activeProjectTab) || projectSummary[0] || null;

  useEffect(() => {
    if (!projectSummary.length) {
      setActiveProjectTab("");
      return;
    }

    if (!projectSummary.some((item) => item.project === activeProjectTab)) {
      setActiveProjectTab(projectSummary[0].project);
    }
  }, [activeProjectTab, projectSummary]);

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
              <p>Despliega el resumen para revisar releases activos y pasados a producción.</p>
            </div>
            <button
              type="button"
              className={`summary-toggle ${showProjectSummary ? "active" : ""}`}
              onClick={() => setShowProjectSummary((current) => !current)}
              aria-expanded={showProjectSummary}
              aria-controls="project-summary-panel"
            >
              <span>Resumen por proyecto</span>
              <strong>{showProjectSummary ? "Ocultar" : "Mostrar"}</strong>
            </button>
          </div>

          {showProjectSummary && (
            projectSummary.length === 0 ? (
              <div className="project-empty" id="project-summary-panel">Aún no hay registros para agrupar.</div>
            ) : (
              <div className="project-tabs-panel" id="project-summary-panel">
                <div className="project-tabs" role="tablist" aria-label="Proyectos">
                  {projectSummary.map((item) => (
                    <button
                      key={item.project}
                      className={`project-tab ${selectedProject?.project === item.project ? "active" : ""}`}
                      onClick={() => setActiveProjectTab(item.project)}
                      type="button"
                      role="tab"
                      aria-selected={selectedProject?.project === item.project}
                    >
                      <span>{item.project}</span>
                      <strong>{item.total}</strong>
                    </button>
                  ))}
                </div>

                {selectedProject && (
                  <div className="project-release-panel">
                    <div className="project-release-header">
                      <div>
                        <h3>{selectedProject.project}</h3>
                        <p>{selectedProject.total} releases registrados</p>
                      </div>
                      <div className="project-release-summary">
                        <span className="status-badge status-active-release">{selectedProject.active} activos</span>
                        <span className="status-badge status-ok">{selectedProject.production} pase prod.</span>
                        <span className="status-badge status-pending">{selectedProject.pendingProduction} pendientes</span>
                      </div>
                    </div>

                    <div className="project-release-list">
                      {selectedProject.releases.map((row) => {
                        const inProduction = isYes(row["Pase a producción"]);
                        const active = isYes(row.Activo);
                        return (
                          <button
                            key={row._rowIndex || row.Release}
                            className={`project-release-item ${inProduction ? "production" : active ? "active-release" : "neutral"}`}
                            type="button"
                            onClick={() => handleEdit(row)}
                          >
                            <span className="release-name">{row.Release || "Sin release"}</span>
                            <span className="release-meta">{row.Flujo || "Sin flujo"}</span>
                            <span className="release-state">
                              {inProduction ? "Pase a producción" : active ? "Activo" : "Inactivo"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="project-legend">
                      <span><i className="legend-dot active-release" /> Activos</span>
                      <span><i className="legend-dot production" /> Pasados a producción</span>
                    </div>
                  </div>
                )}
              </div>
            )
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
