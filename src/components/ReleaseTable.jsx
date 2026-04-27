// src/components/ReleaseTable.jsx
import { Fragment, useState } from "react";
import { deleteReleaseRow } from "../services/localExcelService";

export default function ReleaseTable({ data, onEdit, onDelete, loading, search, onSearchChange }) {
  const [internalSearch, setInternalSearch] = useState("");
  const [filterProyecto, setFilterProyecto] = useState("");
  const [filterPaseProduccion, setFilterPaseProduccion] = useState("");
  const [filterActivo, setFilterActivo] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);

  const useExternalSearch = typeof onSearchChange === "function";
  const searchValue = useExternalSearch ? search : internalSearch;
  const handleSearchChange = (e) => {
    if (useExternalSearch) {
      onSearchChange(e.target.value);
    } else {
      setInternalSearch(e.target.value);
    }
  };

  const proyectos = [...new Set(data.map((r) => r.Proyecto).filter(Boolean))];
  const pasesProduccion = [...new Set(data.map((r) => r["Pase a producción"]).filter(Boolean))];
  const activos = [...new Set(data.map((r) => r.Activo).filter(Boolean))];

  const filtered = data.filter((row) => {
    const matchSearch =
      !searchValue ||
      Object.values(row).some((v) =>
        String(v).toLowerCase().includes(searchValue.toLowerCase())
      );
    const matchProyecto = !filterProyecto || row.Proyecto === filterProyecto;
    const matchPaseProduccion = !filterPaseProduccion || row["Pase a producción"] === filterPaseProduccion;
    const matchActivo = !filterActivo || row.Activo === filterActivo;
    return matchSearch && matchProyecto && matchPaseProduccion && matchActivo;
  });

  const handleDelete = async (row) => {
    if (confirm(`¿Eliminar registro ${row.Release}?`)) {
      try {
        await deleteReleaseRow(row._rowIndex);
        onDelete?.();
      } catch (err) {
        alert(`Error al eliminar: ${err.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="table-section">
      <div className="table-filters">
        {!useExternalSearch && (
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Buscar en todos los campos..."
              value={searchValue}
              onChange={handleSearchChange}
            />
          </div>
        )}
        <select value={filterProyecto} onChange={(e) => setFilterProyecto(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterPaseProduccion} onChange={(e) => setFilterPaseProduccion(e.target.value)}>
          <option value="">Todos los pases</option>
          {pasesProduccion.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={filterActivo} onChange={(e) => setFilterActivo(e.target.value)}>
          <option value="">Todos los estados</option>
          {activos.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <span className="count-badge">{filtered.length} registros</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron registros.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="release-table">
            <thead>
              <tr>
                <th>Release</th>
                <th>Proyecto</th>
                <th>Flujo</th>
                <th>Funcionalidades</th>
                <th>Pase Prod.</th>
                <th>Fecha Pase</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <Fragment key={row._rowIndex || i}>
                  <tr
                    className={expandedRow === i ? "expanded" : ""}
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  >
                    <td className="release-cell">
                      <code>{row.Release || "—"}</code>
                    </td>
                    <td>
                      <span className="tag">{row.Proyecto || "—"}</span>
                    </td>
                    <td>{row.Flujo || "—"}</td>
                    <td className="func-cell">{row.Funcionalidades || "—"}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(row["Pase a producción"])}`}>
                        {row["Pase a producción"] || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge status-neutral">
                        {row["Fecha de Pase"] || "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(row.Activo)}`}>
                        {row.Activo || "—"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-edit"
                        onClick={(e) => { e.stopPropagation(); onEdit(row); }}
                        title="Editar registro"
                      >
                        ✎ Editar
                      </button>
                      <button
                        className="btn-delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                        title="Eliminar registro"
                      >
                        ✕ Eliminar
                      </button>
                    </td>
                  </tr>
                  {expandedRow === i && row["en Base a"] && (
                    <tr className="detail-row" key={`detail-${i}`}>
                      <td colSpan={8}>
                        <div className="detail-panel">
                          <strong>En base a:</strong> {row["en Base a"]}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getStatusClass(val) {
  if (!val) return "";
  const v = String(val).toLowerCase();
  if (v.includes("si") || v.includes("sí") || v.includes("listo") || v.includes("hecho") || v === "-") return "status-ok";
  if (v.includes("no") || v.includes("falta") || v.includes("pendiente")) return "status-pending";
  return "status-neutral";
}
