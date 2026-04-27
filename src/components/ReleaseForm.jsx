// src/components/ReleaseForm.jsx
import { useState, useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { appendReleaseRow, updateReleaseRow, fetchNomenclatura } from "../services/localExcelService";

const EMPTY_FORM = {
  Release: "",
  Proyecto: "",
  Flujo: "",
  "en Base a": "",
  Funcionalidades: "",
  "Pase a producción": "NO",
  "Fecha de Pase": "",
  Activo: "SI",
};

export default function ReleaseForm({ onSuccess, editData, onCancelEdit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [nomenclatura, setNomenclatura] = useState({ abreviaciones: [], proyectos: [] });
  const [success, setSuccess] = useState(false);
  const { call, loading, error, setError } = useLocalStorage();

  useEffect(() => {
    call(fetchNomenclatura).then(setNomenclatura).catch(() => {});
  }, []);

  useEffect(() => {
    if (editData) {
      setForm({ ...EMPTY_FORM, ...editData });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editData]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editData?._rowIndex) {
        await call(updateReleaseRow, editData._rowIndex, form);
      } else {
        await call(appendReleaseRow, form);
      }
      setSuccess(true);
      setForm(EMPTY_FORM);
      onSuccess?.();
      if (editData) onCancelEdit?.();
    } catch (_) {}
  };

  const proyectosOpciones = nomenclatura.proyectos.length
    ? nomenclatura.proyectos
    : ["Crm", "BUM", "BFF-PB", "WC-PB", "Reporting Services", "document Library", "Signature", "CRA", "Web Client-Loans"];
  const flujosOpciones = nomenclatura.flujos?.length
    ? nomenclatura.flujos
    : ["Carpeta Transversal", "Flujo digital", "Flujo hibrido", "Transferencia de Leads", "Flujo Originación", "Diferimiento", "Tranversal"];

  return (
    <form onSubmit={handleSubmit} className="release-form">
      <div className="form-grid">
        <div className="form-group">
          <label>Release</label>
          <input
            type="text"
            name="Release"
            value={form.Release}
            onChange={handleChange}
            placeholder="Ej: 2024.Q1.001"
            required
          />
        </div>

        <div className="form-group">
          <label>Proyecto</label>
          <select name="Proyecto" value={form.Proyecto} onChange={handleChange} required>
            <option value="">Selecciona un proyecto</option>
            {proyectosOpciones.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Flujo</label>
          <select name="Flujo" value={form.Flujo} onChange={handleChange}>
            <option value="">Selecciona un flujo</option>
            {flujosOpciones.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="form-group full-width">
          <label>En Base a</label>
          <input
            type="text"
            name="en Base a"
            value={form["en Base a"]}
            onChange={handleChange}
            placeholder="Referencias o bases..."
          />
        </div>

        <div className="form-group full-width">
          <label>Funcionalidades</label>
          <textarea
            name="Funcionalidades"
            value={form.Funcionalidades}
            onChange={handleChange}
            placeholder="Detalle de funcionalidades..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Pase a producción</label>
          <select name="Pase a producción" value={form["Pase a producción"]} onChange={handleChange}>
            <option value="NO">NO</option>
            <option value="SI">SI</option>
          </select>
        </div>

        <div className="form-group">
          <label>Fecha de Pase</label>
          <input
            type="date"
            name="Fecha de Pase"
            value={form["Fecha de Pase"]}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Activo</label>
          <select name="Activo" value={form.Activo} onChange={handleChange}>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠ {error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>✓ {editData ? "Cambios guardados" : "Registro creado"} correctamente</span>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Guardando..." : editData ? "Guardar cambios" : "Crear registro"}
        </button>
        {editData && (
          <button type="button" className="btn-secondary" onClick={onCancelEdit}>
            Cancelar edición
          </button>
        )}
      </div>
    </form>
  );
}
