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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

const APPROVER_EMAILS = new Set(
  String(import.meta.env.VITE_APPROVER_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
);

function toDayKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getRecordDateKey(row, fallbackIndex) {
  return (
    toDayKey(row.createdAt) ||
    toDayKey(row.updatedAt) ||
    toDayKey(row["Fecha de Pase"]) ||
    `seq-${String(fallbackIndex).padStart(6, "0")}`
  );
}

function getProductionDateKey(row, fallbackIndex) {
  return toDayKey(row["Fecha de Pase"]) || getRecordDateKey(row, fallbackIndex);
}

function getTrendPoints(series, width = 180, height = 56) {
  if (!series.length) return "";

  const padding = 6;
  const values = series.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = series.length === 1 ? 0 : (width - padding * 2) / (series.length - 1);

  return series
    .map((item, index) => {
      const x = padding + stepX * index;
      const y = height - padding - ((item.value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function TrendStatCard({ label, value, tone, series, detail }) {
  const polylinePoints = getTrendPoints(series);

  return (
    <div className="stat-item">
      <div className="stat-chart">
        <svg className="stat-chart-svg" viewBox="0 0 180 56" aria-hidden="true" preserveAspectRatio="none">
          <path className={`stat-chart-grid stat-chart-grid-${tone}`} d="M6 50 H174" />
          {polylinePoints ? (
            <polyline
              className={`stat-chart-line stat-chart-line-${tone}`}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              points={polylinePoints}
            />
          ) : (
            <path className={`stat-chart-line stat-chart-line-${tone}`} d="M6 28 H174" />
          )}
        </svg>
      </div>
      <span className="stat-number">{value}</span>
      <span className={`stat-label ${tone ? `stat-${tone}` : ""}`}>{label}</span>
      <span className="stat-detail">{detail}</span>
    </div>
  );
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
  const canDeleteAll = !isSupabaseBackendEnabled || APPROVER_EMAILS.has(normalizeEmail(user?.email));
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
  const dashboardStats = useMemo(() => {
    const groupedRecords = new Map();
    const groupedProduction = new Map();

    data.forEach((row, index) => {
      const fallbackIndex = Number(row._rowIndex) || index + 1;
      const recordKey = getRecordDateKey(row, fallbackIndex);
      const productionKey = getProductionDateKey(row, fallbackIndex);
      const recordBucket = groupedRecords.get(recordKey) || {
        key: recordKey,
        total: 0,
        active: 0,
        pending: 0,
        projects: new Set(),
      };

      recordBucket.total += 1;
      if (isYes(row.Activo)) recordBucket.active += 1;
      if (!isYes(row["Pase a producción"])) recordBucket.pending += 1;
      if (row.Proyecto) recordBucket.projects.add(row.Proyecto);
      groupedRecords.set(recordKey, recordBucket);

      if (isYes(row["Pase a producción"])) {
        const productionBucket = groupedProduction.get(productionKey) || { key: productionKey, total: 0 };
        productionBucket.total += 1;
        groupedProduction.set(productionKey, productionBucket);
      }
    });

    const sortKeys = (a, b) => a.localeCompare(b);
    const recordSeries = [];
    const productionSeries = [];
    let cumulativeTotal = 0;
    let cumulativeActive = 0;
    let cumulativePending = 0;
    const projects = new Set();

    Array.from(groupedRecords.keys()).sort(sortKeys).forEach((key) => {
      const bucket = groupedRecords.get(key);
      cumulativeTotal += bucket.total;
      cumulativeActive += bucket.active;
      cumulativePending += bucket.pending;
      bucket.projects.forEach((project) => projects.add(project));

      recordSeries.push({
        key,
        total: cumulativeTotal,
        active: cumulativeActive,
        pending: cumulativePending,
        projects: projects.size,
      });
    });

    let cumulativeProduction = 0;
    Array.from(groupedProduction.keys()).sort(sortKeys).forEach((key) => {
      cumulativeProduction += groupedProduction.get(key).total;
      productionSeries.push({
        key,
        production: cumulativeProduction,
      });
    });

    return [
      {
        label: "Registros totales",
        value: data.length,
        tone: "accent",
        detail: recordSeries.length > 1 ? "Tendencia acumulada de registros" : "Aun no hay historial suficiente",
        series: recordSeries.map((item) => ({ key: item.key, value: item.total })),
      },
      {
        label: "Activos",
        value: data.filter((row) => isYes(row.Activo)).length,
        tone: "ok",
        detail: recordSeries.length > 1 ? "Releases activos por fecha de alta" : "Sin variacion historica",
        series: recordSeries.map((item) => ({ key: item.key, value: item.active })),
      },
      {
        label: "Pase a prod.",
        value: data.filter((row) => isYes(row["Pase a producción"])).length,
        tone: "ok",
        detail: productionSeries.length > 1 ? "Pases acumulados por fecha de pase" : "Sin pases registrados aun",
        series: productionSeries.map((item) => ({ key: item.key, value: item.production })),
      },
      {
        label: "Pendiente pase prod.",
        value: data.filter((row) => !isYes(row["Pase a producción"])).length,
        tone: "warn",
        detail: recordSeries.length > 1 ? "Backlog pendiente sobre altas registradas" : "Sin backlog historico",
        series: recordSeries.map((item) => ({ key: item.key, value: item.pending })),
      },
      {
        label: "Proyectos activos",
        value: [...new Set(data.map((row) => row.Proyecto).filter(Boolean))].length,
        tone: "accent",
        detail: recordSeries.length > 1 ? "Crecimiento acumulado del portafolio" : "Primer proyecto registrado",
        series: recordSeries.map((item) => ({ key: item.key, value: item.projects })),
      },
    ];
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
          {dashboardStats.map((stat) => (
            <TrendStatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              tone={stat.tone}
              detail={stat.detail}
              series={stat.series}
            />
          ))}
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
                    disabled={loading || importLoading || data.length === 0 || !canDeleteAll}
                    title={
                      canDeleteAll
                        ? "Eliminar todos los registros"
                        : "Solo los usuarios configurados como aprobadores pueden eliminar todos los registros."
                    }
                  >
                    Eliminar todo
                  </button>
                </div>
              </div>
              {!canDeleteAll && isSupabaseBackendEnabled && (
                <div className="card-inline-note">
                  Solo el usuario aprobador puede usar <strong>Eliminar todo</strong>. Configura su correo en
                  <code> VITE_APPROVER_EMAILS </code>
                  para habilitarlo.
                </div>
              )}
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
