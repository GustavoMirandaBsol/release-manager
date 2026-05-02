import { useState, useEffect, useCallback } from "react";

const PROJECTS_STORAGE_KEY = "releaseManagerProjects";
const DEFAULT_PROJECTS = ["CRM", "BUM", "BFF-PB", "WC-PB", "Reporting Services", "Document Library", "Signature", "CRA", "Web Client-Loans"];

export function useProjectsConfig() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (stored) {
      try {
        setProjects(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading projects config:", e);
        setProjects(DEFAULT_PROJECTS);
      }
    } else {
      setProjects(DEFAULT_PROJECTS);
    }
    setIsLoading(false);
  }, []);

  const saveProjects = useCallback((newProjects) => {
    setProjects(newProjects);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newProjects));
  }, []);

  const addProject = useCallback((projectName) => {
    if (!projectName.trim()) return false;
    if (projects.includes(projectName)) return false;
    const newProjects = [...projects, projectName];
    saveProjects(newProjects);
    return true;
  }, [projects, saveProjects]);

  const removeProject = useCallback((projectName) => {
    const newProjects = projects.filter(p => p !== projectName);
    saveProjects(newProjects);
  }, [projects, saveProjects]);

  const updateProject = useCallback((oldName, newName) => {
    if (!newName.trim() || oldName === newName) return false;
    if (projects.includes(newName) && oldName !== newName) return false;
    const newProjects = projects.map(p => p === oldName ? newName : p);
    saveProjects(newProjects);
    return true;
  }, [projects, saveProjects]);

  const resetToDefaults = useCallback(() => {
    saveProjects(DEFAULT_PROJECTS);
  }, [saveProjects]);

  return {
    projects,
    isLoading,
    addProject,
    removeProject,
    updateProject,
    resetToDefaults,
    saveProjects,
  };
}
