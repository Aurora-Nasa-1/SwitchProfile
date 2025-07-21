import { Core } from '../core.js';

export class ScenarioManager {
    constructor() {
        this.scenarios = [];
        this.storageKey = 'switchprofile_scenarios';
    }
    
    async loadScenarios() {
        try {
            // 从本地存储加载情景
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.scenarios = JSON.parse(stored);
            } else {
                this.scenarios = [];
            }
            
            // 也可以从文件系统加载（如果有的话）
            await this.loadFromFile();
            
        } catch (error) {
            console.error('Failed to load scenarios:', error);
            this.scenarios = [];
        }
    }
    
    async loadFromFile() {
        try {
            // 尝试从模块目录加载配置文件
            const configPath = `${Core.MODULE_PATH}scenarios.json`;
            
            Core.execCommand(`cat "${configPath}"`, (output) => {
                if (output && !output.includes('No such file') && !output.includes('ERROR')) {
                    try {
                        const fileScenarios = JSON.parse(output);
                        if (Array.isArray(fileScenarios)) {
                            // 合并文件中的情景（文件优先）
                            const existingIds = this.scenarios.map(s => s.id);
                            fileScenarios.forEach(scenario => {
                                const existingIndex = this.scenarios.findIndex(s => s.id === scenario.id);
                                if (existingIndex >= 0) {
                                    this.scenarios[existingIndex] = scenario;
                                } else {
                                    this.scenarios.push(scenario);
                                }
                            });
                            this.saveToStorage();
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse scenarios file:', parseError);
                    }
                }
            });
        } catch (error) {
            console.warn('Failed to load scenarios from file:', error);
        }
    }
    
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scenarios));
            return true;
        } catch (error) {
            console.error('Failed to save scenarios to storage:', error);
            throw new Error('本地存储保存失败: ' + error.message);
        }
    }
    
    async saveToFile() {
        return new Promise((resolve, reject) => {
            try {
                const configPath = `${Core.MODULE_PATH}scenarios.json`;
                const content = JSON.stringify(this.scenarios, null, 2);
                
                // 确保目录存在
                Core.execCommand(`mkdir -p "${Core.MODULE_PATH}"`, (mkdirOutput) => {
                    if (mkdirOutput && mkdirOutput.includes('ERROR')) {
                        console.error('Failed to create directory:', mkdirOutput);
                        reject(new Error('目录创建失败: ' + mkdirOutput));
                        return;
                    }
                    
                    // 写入文件 - 使用cat命令避免echo的引号问题
                    const tempFile = `${Core.MODULE_PATH}scenarios.tmp`;
                    const escapedContent = content.replace(/\\/g, '\\\\').replace(/'/g, "'\"'\"'");
                    
                    Core.execCommand(`cat > "${tempFile}" << 'EOF'\n${content}\nEOF`, (writeOutput) => {
                        if (writeOutput && writeOutput.includes('ERROR')) {
                            console.error('Failed to write temp file:', writeOutput);
                            reject(new Error('临时文件写入失败: ' + writeOutput));
                            return;
                        }
                        
                        // 移动临时文件到目标位置
                        Core.execCommand(`mv "${tempFile}" "${configPath}"`, (mvOutput) => {
                            if (mvOutput && mvOutput.includes('ERROR')) {
                                console.error('Failed to move file:', mvOutput);
                                reject(new Error('文件移动失败: ' + mvOutput));
                            } else {
                                console.log('Scenarios saved successfully to file');
                                resolve(true);
                            }
                        });
                    });
                });
            } catch (error) {
                console.error('Failed to save scenarios to file:', error);
                reject(new Error('文件保存失败: ' + error.message));
            }
        });
    }
    
    getScenarios() {
        return this.scenarios;
    }
    
    getScenario(id) {
        return this.scenarios.find(scenario => scenario.id === id);
    }
    
    async addScenario(scenario) {
        // 确保ID唯一
        if (this.scenarios.find(s => s.id === scenario.id)) {
            scenario.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        }
        
        this.scenarios.push(scenario);
        
        try {
            this.saveToStorage();
            await this.saveToFile();
            return scenario;
        } catch (error) {
            // 如果保存失败，回滚操作
            this.scenarios.pop();
            throw error;
        }
    }
    
    async updateScenario(scenario) {
        const index = this.scenarios.findIndex(s => s.id === scenario.id);
        if (index >= 0) {
            const originalScenario = this.scenarios[index];
            this.scenarios[index] = scenario;
            
            try {
                this.saveToStorage();
                await this.saveToFile();
                return true;
            } catch (error) {
                // 如果保存失败，回滚操作
                this.scenarios[index] = originalScenario;
                throw error;
            }
        }
        throw new Error('情景不存在');
    }
    
    async deleteScenario(id) {
        const index = this.scenarios.findIndex(s => s.id === id);
        if (index >= 0) {
            const deletedScenario = this.scenarios[index];
            this.scenarios.splice(index, 1);
            
            try {
                this.saveToStorage();
                await this.saveToFile();
                return true;
            } catch (error) {
                // 如果保存失败，回滚操作
                this.scenarios.splice(index, 0, deletedScenario);
                throw error;
            }
        }
        throw new Error('情景不存在');
    }
    
    generateScript(scenario) {
        let script = '#!/system/sh\n';
        script += `# Generated scenario script: ${scenario.name}\n`;
        script += `# Generated at: ${new Date().toISOString()}\n\n`;
        
        // 导入核心函数
        script += `# Import core functions\n`;
        script += `source "${Core.MODULE_PATH}Core.sh"\n\n`;
        
        // 设置变量
        script += `# Configuration\n`;
        script += `Installer_Compatibility="${scenario.compatibilityMode ? 'true' : 'false'}"\n`;
        script += `Installer_Log="true"\n\n`;
        
        // 检测环境
        script += `# Detect environment\n`;
        script += `if [ -n "$KSU" ]; then\n`;
        script += `    log_info "Running in KernelSU environment"\n`;
        script += `elif [ -n "$APATCH" ]; then\n`;
        script += `    log_info "Running in APatch environment"\n`;
        script += `elif [ -n "$MAGISK_VER_CODE" ]; then\n`;
        script += `    log_info "Running in Magisk environment"\n`;
        script += `else\n`;
        script += `    log_error "No supported environment detected"\n`;
        script += `    exit 1\n`;
        script += `fi\n\n`;
        
        // 执行操作
        script += `# Execute operations\n`;
        scenario.operations.forEach((operation, index) => {
            script += `log_info "Executing operation ${index + 1}: ${this.getOperationDescription(operation)}"\n`;
            script += this.generateOperationScript(operation);
            script += '\n';
        });
        
        // 自动重启
        if (scenario.autoReboot) {
            script += `# Auto reboot\n`;
            script += `log_info "Rebooting device in 3 seconds..."\n`;
            script += `sleep 3\n`;
            script += `reboot\n`;
        }
        
        script += `log_info "Scenario '${scenario.name}' completed successfully"\n`;
        
        return script;
    }
    
    getOperationDescription(operation) {
        switch (operation.type) {
            case 'install_module':
                return `Install module: ${operation.path}`;
            case 'delete_module':
                return `Delete module: ${operation.moduleId}`;
            case 'flash_boot':
                return `Flash boot: ${operation.path} ${operation.anykernel ? '(AnyKernel3)' : ''}`;
            case 'custom_script':
                return 'Execute custom script';
            default:
                return 'Unknown operation';
        }
    }
    
    generateOperationScript(operation) {
        switch (operation.type) {
            case 'install_module':
                return this.generateInstallModuleScript(operation);
            case 'delete_module':
                return this.generateDeleteModuleScript(operation);
            case 'flash_boot':
                return this.generateFlashBootScript(operation);
            case 'custom_script':
                return this.generateCustomScript(operation);
            default:
                return `log_error "Unknown operation type: ${operation.type}"\n`;
        }
    }
    
    generateInstallModuleScript(operation) {
        let script = '';
        
        if (!operation.path) {
            script += `log_error "Module path not specified"\n`;
            script += `exit 1\n`;
            return script;
        }
        
        script += `if [ ! -f "${operation.path}" ]; then\n`;
        script += `    log_error "Module file not found: ${operation.path}"\n`;
        script += `    exit 1\n`;
        script += `fi\n\n`;
        
        script += `log_info "Installing module: ${operation.path}"\n`;
        script += `Installer_Module "${operation.path}"\n`;
        
        script += `if [ $? -eq 0 ]; then\n`;
        script += `    log_info "Module installed successfully"\n`;
        script += `else\n`;
        script += `    log_error "Failed to install module"\n`;
        script += `    exit 1\n`;
        script += `fi\n`;
        
        return script;
    }
    
    generateDeleteModuleScript(operation) {
        let script = '';
        
        if (!operation.moduleId) {
            script += `log_error "Module ID not specified"\n`;
            script += `exit 1\n`;
            return script;
        }
        
        script += `if [ ! -d "/data/adb/modules/${operation.moduleId}" ]; then\n`;
        script += `    log_warn "Module not found: ${operation.moduleId}"\n`;
        script += `else\n`;
        script += `    log_info "Deleting module: ${operation.moduleId}"\n`;
        script += `    Delete_Module "${operation.moduleId}"\n`;
        script += `    if [ $? -eq 0 ]; then\n`;
        script += `        log_info "Module deleted successfully"\n`;
        script += `    else\n`;
        script += `        log_error "Failed to delete module"\n`;
        script += `        exit 1\n`;
        script += `    fi\n`;
        script += `fi\n`;
        
        return script;
    }
    
    generateFlashBootScript(operation) {
        let script = '';
        
        if (!operation.path) {
            script += `log_error "Boot image path not specified"\n`;
            script += `exit 1\n`;
            return script;
        }
        
        script += `if [ ! -f "${operation.path}" ]; then\n`;
        script += `    log_error "Boot image not found: ${operation.path}"\n`;
        script += `    exit 1\n`;
        script += `fi\n\n`;
        
        script += `log_info "Flashing boot image: ${operation.path}"\n`;
        script += `flash_boot "${operation.path}" "${operation.anykernel ? 'true' : 'false'}"\n`;
        
        script += `if [ $? -eq 0 ]; then\n`;
        script += `    log_info "Boot image flashed successfully"\n`;
        script += `else\n`;
        script += `    log_error "Failed to flash boot image"\n`;
        script += `    exit 1\n`;
        script += `fi\n`;
        
        return script;
    }
    
    generateCustomScript(operation) {
        let script = '';
        
        if (!operation.script) {
            script += `log_error "Custom script content not specified"\n`;
            script += `exit 1\n`;
            return script;
        }
        
        script += `log_info "Executing custom script"\n`;
        script += `# Custom script start\n`;
        script += operation.script;
        if (!operation.script.endsWith('\n')) {
            script += '\n';
        }
        script += `# Custom script end\n`;
        script += `log_info "Custom script completed"\n`;
        
        return script;
    }
    
    exportScenarios() {
        return JSON.stringify(this.scenarios, null, 2);
    }
    
    importScenarios(jsonData) {
        try {
            const imported = JSON.parse(jsonData);
            if (Array.isArray(imported)) {
                // 合并导入的情景
                imported.forEach(scenario => {
                    // 确保ID唯一
                    if (this.scenarios.find(s => s.id === scenario.id)) {
                        scenario.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                    }
                    this.scenarios.push(scenario);
                });
                
                this.saveToStorage();
                this.saveToFile();
                return true;
            }
        } catch (error) {
            console.error('Import scenarios error:', error);
        }
        return false;
    }
}