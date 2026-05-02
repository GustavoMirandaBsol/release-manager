import { useState, useEffect, useCallback } from "react";

const FLOWS_STORAGE_KEY = "releaseManagerFlows";
const DEFAULT_FLOWS = [
  "Carpeta Transversal",
  "Flujo digital",
  "Flujo híbrido",
  "Transferencia de Leads",
  "Flujo Originación",
  "Diferimiento",
  "Transversal",
];

export function useFlowsConfig() {
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(FLOWS_STORAGE_KEY);
    if (stored) {
      try {
        setFlows(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading flows config:", e);
        setFlows(DEFAULT_FLOWS);
      }
    } else {
      setFlows(DEFAULT_FLOWS);
    }
    setIsLoading(false);
  }, []);

  const saveFlows = useCallback((newFlows) => {
    setFlows(newFlows);
    localStorage.setItem(FLOWS_STORAGE_KEY, JSON.stringify(newFlows));
  }, []);

  const addFlow = useCallback((flowName) => {
    if (!flowName.trim()) return false;
    if (flows.includes(flowName)) return false;
    const newFlows = [...flows, flowName];
    saveFlows(newFlows);
    return true;
  }, [flows, saveFlows]);

  const removeFlow = useCallback((flowName) => {
    const newFlows = flows.filter(f => f !== flowName);
    saveFlows(newFlows);
  }, [flows, saveFlows]);

  const updateFlow = useCallback((oldName, newName) => {
    if (!newName.trim() || oldName === newName) return false;
    if (flows.includes(newName) && oldName !== newName) return false;
    const newFlows = flows.map(f => f === oldName ? newName : f);
    saveFlows(newFlows);
    return true;
  }, [flows, saveFlows]);

  const resetToDefaults = useCallback(() => {
    saveFlows(DEFAULT_FLOWS);
  }, [saveFlows]);

  return {
    flows,
    isLoading,
    addFlow,
    removeFlow,
    updateFlow,
    resetToDefaults,
    saveFlows,
  };
}
