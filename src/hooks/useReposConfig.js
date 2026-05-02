import { useState, useEffect, useCallback } from "react";

const REPOS_CONFIG_KEY = "releaseManagerReposConfig";
const DEFAULT_REPOS_CONFIG = {
  "CRM": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/crm-repo",
  "BUM": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/bum-repo",
  "BFF-PB": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/bff-pb-repo",
  "WC-PB": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/wc-pb-repo",
  "Reporting Services": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/reporting-repo",
  "Document Library": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/doc-lib-repo",
  "Signature": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/signature-repo",
  "CRA": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/cra-repo",
  "Web Client-Loans": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/web-client-loans-repo",
  "BFF-Loans": "https://dev.azure.com/bsolbo/cd-digitalizacion-procesos/_git/bff-loans-repo",
};

export function useReposConfig() {
  const [reposConfig, setReposConfig] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(REPOS_CONFIG_KEY);
    if (stored) {
      try {
        setReposConfig(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading repos config:", e);
        setReposConfig(DEFAULT_REPOS_CONFIG);
      }
    } else {
      setReposConfig(DEFAULT_REPOS_CONFIG);
    }
    setIsLoading(false);
  }, []);

  const saveReposConfig = useCallback((newConfig) => {
    setReposConfig(newConfig);
    localStorage.setItem(REPOS_CONFIG_KEY, JSON.stringify(newConfig));
  }, []);

  const getRepoForProject = useCallback((projectName) => {
    return reposConfig[projectName] || null;
  }, [reposConfig]);

  const updateRepoForProject = useCallback((projectName, repoUrl) => {
    const newConfig = { ...reposConfig, [projectName]: repoUrl };
    saveReposConfig(newConfig);
  }, [reposConfig, saveReposConfig]);

  const removeRepoForProject = useCallback((projectName) => {
    const newConfig = { ...reposConfig };
    delete newConfig[projectName];
    saveReposConfig(newConfig);
  }, [reposConfig, saveReposConfig]);

  const resetToDefaults = useCallback(() => {
    saveReposConfig(DEFAULT_REPOS_CONFIG);
  }, [saveReposConfig]);

  return {
    reposConfig,
    isLoading,
    getRepoForProject,
    updateRepoForProject,
    removeRepoForProject,
    resetToDefaults,
    saveReposConfig,
  };
}
