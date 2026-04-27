// src/hooks/useLocalStorage.js
import { useState, useCallback } from "react";

export function useLocalStorage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback(async (fn, ...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      return result;
    } catch (err) {
      const errorMsg = err.message || "Error desconocido";
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error, setError };
}
