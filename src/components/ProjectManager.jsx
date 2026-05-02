import { useState } from "react";
import { useProjectsConfig } from "../hooks/useProjectsConfig";
import "../styles/ProjectManager.css";

export default function ProjectManager() {
  const { projects, isLoading, addProject, removeProject, updateProject, resetToDefaults } = useProjectsConfig();
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProject, setEditingProject] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [message, setMessage] = useState("");

  const handleAddProject = () => {
    const success = addProject(newProjectName);
    if (success) {
      setNewProjectName("");
      setMessage({ type: "success", text: "Proyecto agregado correctamente" });
      setTimeout(() => setMessage(""), 2000);
    } else if (newProjectName.trim()) {
      setMessage({ type: "error", text: "El proyecto ya existe o el nombre está vacío" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleDeleteProject = (project) => {
    if (confirm(`¿Eliminar proyecto "${project}"?`)) {
      removeProject(project);
      setMessage({ type: "success", text: "Proyecto eliminado" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleStartEdit = (project) => {
    setEditingProject(project);
    setEditingValue(project);
  };

  const handleSaveEdit = () => {
    const success = updateProject(editingProject, editingValue);
    if (success) {
      setEditingProject(null);
      setEditingValue("");
      setMessage({ type: "success", text: "Proyecto actualizado" });
      setTimeout(() => setMessage(""), 2000);
    } else {
      setMessage({ type: "error", text: "No se pudo actualizar el proyecto" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("¿Restaurar la lista predeterminada de proyectos? Esto eliminará todos los cambios.")) {
      resetToDefaults();
      setMessage({ type: "success", text: "Proyectos restaurados a valores predeterminados" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  if (isLoading) {
    return <div className="pm-loading">Cargando proyectos...</div>;
  }

  return (
    <div className="project-manager">
      <h2>Administrar Proyectos</h2>

      {message && (
        <div className={`pm-message pm-message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="pm-add-section">
        <h3>Agregar nuevo proyecto</h3>
        <div className="pm-input-group">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nombre del nuevo proyecto"
            onKeyPress={(e) => e.key === "Enter" && handleAddProject()}
          />
          <button onClick={handleAddProject} className="pm-btn-add">
            + Agregar
          </button>
        </div>
      </div>

      <div className="pm-list-section">
        <h3>Proyectos actuales ({projects.length})</h3>
        <div className="pm-list">
          {projects.length === 0 ? (
            <p className="pm-empty">No hay proyectos. Restaura los predeterminados.</p>
          ) : (
            projects.map((project) => (
              <div key={project} className="pm-item">
                {editingProject === project ? (
                  <div className="pm-edit-mode">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="pm-btn-save">
                      ✓ Guardar
                    </button>
                    <button
                      onClick={() => setEditingProject(null)}
                      className="pm-btn-cancel"
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="pm-project-name">{project}</span>
                    <div className="pm-actions">
                      <button
                        onClick={() => handleStartEdit(project)}
                        className="pm-btn-edit"
                        title="Editar nombre del proyecto"
                      >
                        ✎ Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project)}
                        className="pm-btn-delete"
                        title="Eliminar proyecto"
                      >
                        ✕ Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pm-footer">
        <button onClick={handleResetDefaults} className="pm-btn-reset">
          ⟲ Restaurar predeterminados
        </button>
      </div>
    </div>
  );
}
