import { useState } from "react";
import { useReposConfig } from "../hooks/useReposConfig";
import "../styles/ReposManager.css";

export default function ReposManager() {
  const { reposConfig, isLoading, updateRepoForProject, removeRepoForProject, resetToDefaults } = useReposConfig();
  const [newProject, setNewProject] = useState("");
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [editingProject, setEditingProject] = useState(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [message, setMessage] = useState("");

  const handleAddRepo = () => {
    if (!newProject.trim() || !newRepoUrl.trim()) {
      setMessage({ type: "error", text: "Proyecto y URL del repositorio son requeridos" });
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    if (reposConfig[newProject] && newProject !== editingProject) {
      setMessage({ type: "error", text: "Ya existe un repositorio configurado para este proyecto" });
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    updateRepoForProject(newProject, newRepoUrl);
    setNewProject("");
    setNewRepoUrl("");
    setMessage({ type: "success", text: "Repositorio agregado correctamente" });
    setTimeout(() => setMessage(""), 2000);
  };

  const handleDeleteRepo = (project) => {
    if (confirm(`¿Eliminar la configuración del repositorio para "${project}"?`)) {
      removeRepoForProject(project);
      setMessage({ type: "success", text: "Repositorio eliminado" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleStartEdit = (project, url) => {
    setEditingProject(project);
    setEditingUrl(url);
  };

  const handleSaveEdit = () => {
    if (!editingUrl.trim()) {
      setMessage({ type: "error", text: "La URL del repositorio no puede estar vacía" });
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    updateRepoForProject(editingProject, editingUrl);
    setEditingProject(null);
    setEditingUrl("");
    setMessage({ type: "success", text: "Repositorio actualizado" });
    setTimeout(() => setMessage(""), 2000);
  };

  const handleResetDefaults = () => {
    if (confirm("¿Restaurar la configuración predeterminada de repositorios? Esto eliminará todos los cambios.")) {
      resetToDefaults();
      setMessage({ type: "success", text: "Repositorios restaurados a valores predeterminados" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  if (isLoading) {
    return <div className="rm-loading">Cargando configuración de repositorios...</div>;
  }

  return (
    <div className="repos-manager">
      <h2>Configuración de Repositorios</h2>

      {message && (
        <div className={`rm-message rm-message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="rm-add-section">
        <h3>Agregar/Editar repositorio</h3>
        <div className="rm-input-group">
          <input
            type="text"
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            placeholder="Nombre del proyecto"
          />
          <input
            type="url"
            value={newRepoUrl}
            onChange={(e) => setNewRepoUrl(e.target.value)}
            placeholder="URL del repositorio (https://...)"
          />
          <button onClick={handleAddRepo} className="rm-btn-add">
            + Agregar
          </button>
        </div>
      </div>

      <div className="rm-list-section">
        <h3>Repositorios configurados ({Object.keys(reposConfig).length})</h3>
        <div className="rm-list">
          {Object.keys(reposConfig).length === 0 ? (
            <p className="rm-empty">No hay repositorios configurados. Restaura los predeterminados.</p>
          ) : (
            Object.entries(reposConfig).map(([project, repoUrl]) => (
              <div key={project} className="rm-item">
                {editingProject === project ? (
                  <div className="rm-edit-mode">
                    <div className="rm-edit-fields">
                      <strong>{project}</strong>
                      <input
                        type="url"
                        value={editingUrl}
                        onChange={(e) => setEditingUrl(e.target.value)}
                        placeholder="URL del repositorio"
                        autoFocus
                      />
                    </div>
                    <div className="rm-edit-actions">
                      <button onClick={handleSaveEdit} className="rm-btn-save">
                        ✓ Guardar
                      </button>
                      <button
                        onClick={() => setEditingProject(null)}
                        className="rm-btn-cancel"
                      >
                        ✕ Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rm-repo-info">
                      <strong className="rm-project-name">{project}</strong>
                      <span className="rm-repo-url">{repoUrl}</span>
                    </div>
                    <div className="rm-actions">
                      <button
                        onClick={() => handleStartEdit(project, repoUrl)}
                        className="rm-btn-edit"
                        title="Editar URL del repositorio"
                      >
                        ✎ Editar
                      </button>
                      <button
                        onClick={() => handleDeleteRepo(project)}
                        className="rm-btn-delete"
                        title="Eliminar configuración"
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

      <div className="rm-footer">
        <button onClick={handleResetDefaults} className="rm-btn-reset">
          ⟲ Restaurar predeterminados
        </button>
      </div>
    </div>
  );
}
