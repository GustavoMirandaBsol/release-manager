// src/hooks/useGraphApi.js
import { useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../services/authConfig";

export function useGraphApi() {
  const { instance, accounts } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getToken = useCallback(async () => {
    if (!accounts[0]) throw new Error("No hay sesión activa");
    const response = await instance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });
    return response.accessToken;
  }, [instance, accounts]);

  const call = useCallback(
    async (fn, ...args) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const result = await fn(token, ...args);
        return result;
      } catch (err) {
        // If silent token fails, try interactive
        if (err.name === "InteractionRequiredAuthError") {
          const response = await instance.acquireTokenPopup(loginRequest);
          const result = await fn(response.accessToken, ...args);
          return result;
        }
        setError(err.message || "Error desconocido");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getToken, instance]
  );

  return { call, loading, error, setError };
}
