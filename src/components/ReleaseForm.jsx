// src/components/ReleaseForm.jsx
import { useMemo, useState, useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useProjectsConfig } from "../hooks/useProjectsConfig";
import { useFlowsConfig } from "../hooks/useFlowsConfig";
import { appendReleaseRow, updateReleaseRow, fetchNomenclatura } from "../services/localExcelService";

const RELEASE_MODES = {
  candidate: "candidate",
  releaseCandidate: "releaseCandidate",
  consolidated: "consolidated",
};

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

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toReleasePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toConsolidatedPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDatePart() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function getVersionPatch(release) {
  const match = String(release || "").match(/(?:releasev|_V)(\d+)\.(\d+)\.(\d+)/i);
  return match ? Number(match[3]) : null;
}

function getFlowAbbreviation(flow, abbreviations = []) {
  const explicit = String(flow || "").match(/\(([A-Z0-9-]+)\)/);
  if (explicit) return explicit[1];

  const flowKey = normalizeKey(flow);
  const known = [
    ["carpeta transversal", "CT"],
    ["flujo digital", "FD"],
    ["flujo hibrido", "FH"],
    ["flujo híbrido", "FH"],
    ["transferencia de leads", "TDH"],
    ["flujo originacion", "FO"],
    ["flujo originación", "FO"],
    ["diferimiento", "DIF"],
    ["transversal", "ALL"],
    ["tranversal", "ALL"],
  ].find(([label]) => flowKey.includes(normalizeKey(label)));

  if (known) return known[1];
  return abbreviations.find(Boolean) || "REL";
}

function getProjectGroup(rowProject, project) {
  return normalizeKey(rowProject) === normalizeKey(project);
}

function getNextPatch(existingData, mode, project, consolidatedProjects) {
  const projects = [project, ...consolidatedProjects]
    .map(normalizeKey)
    .filter(Boolean);
  const consolidated = mode === RELEASE_MODES.consolidated;

  const maxPatch = existingData.reduce((max, row) => {
    const release = row.Release || "";
    const patch = getVersionPatch(release);
    if (!patch) return max;

    const releaseKey = normalizeKey(release);
    const isConsolidated = releaseKey.includes("consolidate");
    const belongsToProject = consolidated
      ? projects.every((item) => releaseKey.includes(item.replace(/\s+/g, "-")) || releaseKey.includes(item.replace(/\s+/g, "_")))
      : getProjectGroup(row.Proyecto, project);

    if (consolidated !== isConsolidated) return max;
    if (!belongsToProject) return max;
    return Math.max(max, patch);
  }, 0);

  return maxPatch + 1;
}

function buildReleaseName({ mode, project, flow, detail, consolidatedProjects, existingData, abbreviations }) {
  if (!project) return "";

  const patch = getNextPatch(existingData, mode, project, consolidatedProjects);
  const suffix = toReleasePart(detail) || `${getFlowAbbreviation(flow, abbreviations)}_${toReleasePart(project)}`;

  if (mode === RELEASE_MODES.releaseCandidate) {
    return `release/candidate${getDatePart()}_V1.0.${patch}_${suffix}`;
  }

  if (mode === RELEASE_MODES.consolidated) {
    const projectParts = [project, ...consolidatedProjects]
      .map(toConsolidatedPart)
      .filter(Boolean);

    return `candidate/releasev1.0.${patch}-Consolidate-${projectParts.join("-")}`;
  }

  return `candidate/releasev1.0.${patch}_${suffix}`;
}

export default function ReleaseForm({ onSuccess, editData, onCancelEdit, existingData = [] }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [nomenclatura, setNomenclatura] = useState({ abreviaciones: [], proyectos: [] });
  const [releaseMode, setReleaseMode] = useState(RELEASE_MODES.candidate);
  const [releaseDetail, setReleaseDetail] = useState("");
  const [consolidatedProjectsText, setConsolidatedProjectsText] = useState("");
  const [autoRelease, setAutoRelease] = useState(true);
  const [isEditingRelease, setIsEditingRelease] = useState(false);
  const [success, setSuccess] = useState(false);
  const { call, loading, error, setError } = useLocalStorage();
  const { projects: configProjects } = useProjectsConfig();
  const { flows: configFlows } = useFlowsConfig();

  useEffect(() => {
    call(fetchNomenclatura).then(setNomenclatura).catch(() => {});
  }, []);

  useEffect(() => {
    if (editData) {
      setForm({ ...EMPTY_FORM, ...editData });
      setAutoRelease(false);
    } else {
      setForm(EMPTY_FORM);
      setReleaseMode(RELEASE_MODES.candidate);
      setReleaseDetail("");
      setConsolidatedProjectsText("");
      setAutoRelease(true);
      setIsEditingRelease(false);
    }
  }, [editData]);

  const handleChange = (e) => {
    if (e.target.name === "Release") setAutoRelease(false);
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
      setReleaseDetail("");
      setConsolidatedProjectsText("");
      setAutoRelease(true);
      onSuccess?.();
      if (editData) onCancelEdit?.();
    } catch (_) {}
  };

  const proyectosOpciones = nomenclatura.proyectos.length
    ? nomenclatura.proyectos
    : configProjects;
  const flujosOpciones = nomenclatura.flujos?.length
    ? nomenclatura.flujos
    : configFlows;
  const consolidatedProjects = useMemo(
    () => consolidatedProjectsText
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean),
    [consolidatedProjectsText]
  );
  const generatedRelease = useMemo(
    () => buildReleaseName({
      mode: releaseMode,
      project: form.Proyecto,
      flow: form.Flujo,
      detail: releaseDetail,
      consolidatedProjects,
      existingData,
      abbreviations: nomenclatura.abreviaciones,
    }),
    [releaseMode, form.Proyecto, form.Flujo, releaseDetail, consolidatedProjects, existingData, nomenclatura.abreviaciones]
  );

  useEffect(() => {
    if (!editData && autoRelease && generatedRelease) {
      setForm((current) => ({ ...current, Release: generatedRelease }));
    }
  }, [autoRelease, editData, generatedRelease]);

  const handleGenerateRelease = () => {
    if (!generatedRelease) return;
    setAutoRelease(true);
    setForm((current) => ({ ...current, Release: generatedRelease }));
  };

  return (
    <form onSubmit={handleSubmit} className="release-form">
      <div className="form-grid">
        {!editData && (
          <>
            <div className="form-group">
              <label>Tipo de nomenclatura</label>
              <select
                value={releaseMode}
                onChange={(e) => {
                  setReleaseMode(e.target.value);
                  setAutoRelease(true);
                }}
              >
                <option value={RELEASE_MODES.candidate}>candidate/releasev1.0.N</option>
                <option value={RELEASE_MODES.releaseCandidate}>release/candidate fecha + V1.0.N</option>
                <option value={RELEASE_MODES.consolidated}>Consolidado</option>
              </select>
            </div>

            <div className="form-group">
              <label>Detalle nomenclatura</label>
              <input
                type="text"
                value={releaseDetail}
                onChange={(e) => {
                  setReleaseDetail(e.target.value);
                  setAutoRelease(true);
                }}
                placeholder="Escribe el nombre del release a crear"
              />
              <span className="hint">Si lo dejas vacío usa flujo + proyecto.</span>
            </div>

            {releaseMode === RELEASE_MODES.consolidated && (
              <div className="form-group full-width">
                <label>Proyectos a consolidar</label>
                <input
                  type="text"
                  value={consolidatedProjectsText}
                  onChange={(e) => {
                    setConsolidatedProjectsText(e.target.value);
                    setAutoRelease(true);
                  }}
                  placeholder="Ej: BFF-PB, WC-PB, CRM"
                />
                <span className="hint">El proyecto principal se toma del campo Proyecto.</span>
              </div>
            )}
          </>
        )}

        <div className="form-group">
          <label>Release</label>
          <div className="release-input-wrapper">
            <input
              type="text"
              name="Release"
              value={form.Release}
              onChange={handleChange}
              readOnly={!isEditingRelease}
              placeholder="Ej: 2024.Q1.001"
              required
            />
            {!isEditingRelease && form.Release && (
              <div className="release-icons">
                <button
                  type="button"
                  className="release-icon-btn"
                  onClick={() => navigator.clipboard.writeText(form.Release)}
                  title="Copiar release"
                >
                  📋
                </button>
                <button
                  type="button"
                  className="release-icon-btn"
                  onClick={() => setIsEditingRelease(true)}
                  title="Editar release"
                >
                  ✎
                </button>
              </div>
            )}
          </div>
          {!editData && (
            <div className="release-helper">
              <button type="button" className="inline-action" onClick={handleGenerateRelease}>
                Generar release
              </button>
              {generatedRelease && (
                <span className="hint">Siguiente sugerido: {generatedRelease}</span>
              )}
            </div>
          )}
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
