// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import ReleaseForm from "../components/ReleaseForm";
import ReleaseTable from "../components/ReleaseTable";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  fetchReleaseData,
  exportToExcel,
  importFromExcel,
  deleteAllReleaseRows,
} from "../services/localExcelService";

function isYes(value) {
  return ["si", "sí", "hecho", "listo"].includes(String(value || "").trim().toLowerCase());
}

export default function Dashboard({ onLogout }) {
  const { call, loading } = useLocalStorage();
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState("form");
  const [editData, setEditData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [fetchError, setFetchError] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleEdit = (row) => {
    setEditData(row);
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSuccess = () => {
    loadData();
    setActiveTab("tabla");
  };

  const handleExport = () => {
    try {
      exportToExcel();
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
            <p className="subtitle">Gestión de Releases y Funcionalidades (Local)</p>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <div className="user-avatar">L</div>
            <div>
              <p className="user-name">Modo Local</p>
              <p className="user-email">Almacenamiento en navegador</p>
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
