import { useState } from "react";
import { useFlowsConfig } from "../hooks/useFlowsConfig";
import "../styles/FlowManager.css";

export default function FlowManager() {
  const { flows, isLoading, addFlow, removeFlow, updateFlow, resetToDefaults } = useFlowsConfig();
  const [newFlowName, setNewFlowName] = useState("");
  const [editingFlow, setEditingFlow] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [message, setMessage] = useState("");

  const handleAddFlow = () => {
    const success = addFlow(newFlowName);
    if (success) {
      setNewFlowName("");
      setMessage({ type: "success", text: "Flujo agregado correctamente" });
      setTimeout(() => setMessage(""), 2000);
    } else if (newFlowName.trim()) {
      setMessage({ type: "error", text: "El flujo ya existe o el nombre está vacío" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleDeleteFlow = (flow) => {
    if (confirm(`¿Eliminar flujo "${flow}"?`)) {
      removeFlow(flow);
      setMessage({ type: "success", text: "Flujo eliminado" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleStartEdit = (flow) => {
    setEditingFlow(flow);
    setEditingValue(flow);
  };

  const handleSaveEdit = () => {
    const success = updateFlow(editingFlow, editingValue);
    if (success) {
      setEditingFlow(null);
      setEditingValue("");
      setMessage({ type: "success", text: "Flujo actualizado" });
      setTimeout(() => setMessage(""), 2000);
    } else {
      setMessage({ type: "error", text: "No se pudo actualizar el flujo" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("¿Restaurar la lista predeterminada de flujos? Esto eliminará todos los cambios.")) {
      resetToDefaults();
      setMessage({ type: "success", text: "Flujos restaurados a valores predeterminados" });
      setTimeout(() => setMessage(""), 2000);
    }
  };

  if (isLoading) {
    return <div className="fm-loading">Cargando flujos...</div>;
  }

  return (
    <div className="flow-manager">
      <h2>Administrar Flujos</h2>

      {message && (
        <div className={`fm-message fm-message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="fm-add-section">
        <h3>Agregar nuevo flujo</h3>
        <div className="fm-input-group">
          <input
            type="text"
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            placeholder="Nombre del nuevo flujo"
            onKeyPress={(e) => e.key === "Enter" && handleAddFlow()}
          />
          <button onClick={handleAddFlow} className="fm-btn-add">
            + Agregar
          </button>
        </div>
      </div>

      <div className="fm-list-section">
        <h3>Flujos actuales ({flows.length})</h3>
        <div className="fm-list">
          {flows.length === 0 ? (
            <p className="fm-empty">No hay flujos. Restaura los predeterminados.</p>
          ) : (
            flows.map((flow) => (
              <div key={flow} className="fm-item">
                {editingFlow === flow ? (
                  <div className="fm-edit-mode">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="fm-btn-save">
                      ✓ Guardar
                    </button>
                    <button
                      onClick={() => setEditingFlow(null)}
                      className="fm-btn-cancel"
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="fm-flow-name">{flow}</span>
                    <div className="fm-actions">
                      <button
                        onClick={() => handleStartEdit(flow)}
                        className="fm-btn-edit"
                        title="Editar nombre del flujo"
                      >
                        ✎ Editar
                      </button>
                      <button
                        onClick={() => handleDeleteFlow(flow)}
                        className="fm-btn-delete"
                        title="Eliminar flujo"
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

      <div className="fm-footer">
        <button onClick={handleResetDefaults} className="fm-btn-reset">
          ⟲ Restaurar predeterminados
        </button>
      </div>
    </div>
  );
}
