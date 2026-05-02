import { useReposConfig } from "../hooks/useReposConfig";

export class GitService {
  constructor(reposConfig) {
    this.reposConfig = reposConfig;
  }

  getRepoUrl(projectName) {
    return this.reposConfig[projectName] || null;
  }

  async createBranch(projectName, branchName, baseBranch = 'main') {
    const repoUrl = this.getRepoUrl(projectName);
    if (!repoUrl) {
      throw new Error(`No se encontró repositorio configurado para el proyecto: ${projectName}`);
    }

    try {
      // Ejecutar comandos Git para crear la branch
      const result = await this.executeGitCommands(repoUrl, branchName, baseBranch);
      return result;
    } catch (error) {
      console.error('Error creando branch:', error);
      throw error;
    }
  }

  async executeGitCommands(repoUrl, branchName, baseBranch) {
    // Simular la ejecución de comandos Git
    // En un entorno real, esto se haría ejecutando comandos Git
    console.log(`Ejecutando: git ls-remote ${repoUrl}`);
    console.log(`Ejecutando: git push ${repoUrl} ${baseBranch}:${branchName}`);

    // Simulación de respuesta exitosa
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simular verificación del repositorio
        if (repoUrl.includes('dev.azure.com')) {
          resolve({
            success: true,
            repoUrl,
            branchName,
            message: `Branch '${branchName}' creada exitosamente en Azure DevOps para ${repoUrl}`
          });
        } else {
          reject(new Error('Tipo de repositorio no soportado. Solo se soportan repositorios de Azure DevOps.'));
        }
      }, 2000);
    });
  }

  generateBranchName(releaseName, releaseMode) {
    // Basado en el patrón que mencionaste: release/{release-name} y candidate/{release-name}
    const prefix = releaseMode === 'consolidated' ? 'release' : 'candidate';
    return `${prefix}/${releaseName}`;
  }

  // Método para verificar si una branch ya existe
  async branchExists(projectName, branchName) {
    const repoUrl = this.getRepoUrl(projectName);
    if (!repoUrl) return false;

    try {
      // En producción, verificar con API de Azure DevOps o Git
      console.log(`Verificando si existe branch ${branchName} en ${repoUrl}`);
      return false; // Simular que no existe
    } catch (error) {
      return false;
    }
  }
}

// Hook para usar el servicio de Git
export function useGitService() {
  const { reposConfig } = useReposConfig();
  const gitService = new GitService(reposConfig);

  return gitService;
}
