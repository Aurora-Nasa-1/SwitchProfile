import { Core } from '../core.js';

export class ScenarioManager {
    constructor() {
        this.scenarios = [];
        this.scriptsPath = `${Core.MODULE_PATH}scenarios/`;
    }
    
    async loadScenarios() {
        try {
            // 从脚本目录加载所有.sh文件
            await this.loadFromScriptFiles();
            
        } catch (error) {
            console.error('Failed to load scenarios:', error);
            this.scenarios = [];
        }
    }
    
    async loadFromScriptFiles() {
        return new Promise((resolve, reject) => {
            try {
                // 确保脚本目录存在
                Core.execCommand(`mkdir -p "${this.scriptsPath}"`, (mkdirOutput) => {
                    if (mkdirOutput && mkdirOutput.includes('ERROR')) {
                        console.warn('Failed to create scripts directory:', mkdirOutput);
                    }
                    
                    // 列出所有.sh文件
                    Core.execCommand(`find "${this.scriptsPath}" -name "*.sh" -type f`, (output) => {
                        if (output && !output.includes('No such file') && !output.includes('ERROR')) {
                            const scriptFiles = output.trim().split('\n').filter(file => file.trim());
                            this.scenarios = [];
                            
                            let loadedCount = 0;
                            const totalFiles = scriptFiles.length;
                            
                            if (totalFiles === 0) {
                                resolve();
                                return;
                            }
                            
                            scriptFiles.forEach(scriptPath => {
                                this.parseScriptFile(scriptPath, () => {
                                    loadedCount++;
                                    if (loadedCount === totalFiles) {
                                        resolve();
                                    }
                                });
                            });
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.warn('Failed to load scenarios from script files:', error);
                reject(error);
            }
        });
    }
    
    parseScriptFile(scriptPath, callback) {
        Core.execCommand(`head -20 "${scriptPath}"`, (output) => {
            try {
                if (output && !output.includes('ERROR')) {
                    const lines = output.split('\n');
                    const scenario = {
                        id: this.extractScriptId(scriptPath),
                        name: this.extractMetadata(lines, 'Generated scenario script:') || 'Unknown Scenario',
                        compatibilityMode: this.extractMetadata(lines, 'Installer_Compatibility=') === 'true',
                        autoReboot: this.checkAutoReboot(lines),
                        operations: this.extractOperations(lines),
                        scriptPath: scriptPath
                    };
                    
                    this.scenarios.push(scenario);
                }
            } catch (error) {
                console.warn('Failed to parse script file:', scriptPath, error);
            }
            callback();
        });
    }
    
    extractScriptId(scriptPath) {
        const filename = scriptPath.split('/').pop();
        return filename.replace('.sh', '');
    }
    
    extractMetadata(lines, prefix) {
        const line = lines.find(l => l.includes(prefix));
        if (line) {
            return line.split(prefix)[1]?.trim().replace(/"/g, '');
        }
        return null;
    }
    
    checkAutoReboot(lines) {
        return lines.some(line => line.includes('reboot') && !line.startsWith('#'));
    }
    
    extractOperations(lines) {
        // 简化的操作提取，实际情况下可能需要更复杂的解析
        const operations = [];
        lines.forEach(line => {
            if (line.includes('Installer_Module')) {
                operations.push({ type: 'install_module', path: 'extracted from script' });
            } else if (line.includes('Delete_Module')) {
                operations.push({ type: 'delete_module', moduleId: 'extracted from script' });
            } else if (line.includes('flash_boot')) {
                operations.push({ type: 'flash_boot', path: 'extracted from script' });
            }
        });
        return operations;
    }
    
    async saveScriptToFile(scenario) {
        return new Promise((resolve, reject) => {
            try {
                const scriptPath = `${this.scriptsPath}${scenario.id}.sh`;
                const scriptContent = this.generateScript(scenario);
                
                // 确保脚本目录存在
                Core.execCommand(`mkdir -p "${this.scriptsPath}"`, (mkdirOutput) => {
                    if (mkdirOutput && mkdirOutput.includes('ERROR')) {
                        console.error('Failed to create scripts directory:', mkdirOutput);
                        reject(new Error('脚本目录创建失败: ' + mkdirOutput));
                        return;
                    }
                    
                    // 写入脚本文件
                    const tempFile = `${scriptPath}.tmp`;
                    
                    Core.execCommand(`cat > "${tempFile}" << 'EOF'\n${scriptContent}\nEOF`, (writeOutput) => {
                        if (writeOutput && writeOutput.includes('ERROR')) {
                            console.error('Failed to write temp script file:', writeOutput);
                            reject(new Error('临时脚本文件写入失败: ' + writeOutput));
                            return;
                        }
                        
                        // 移动临时文件到目标位置并设置执行权限
                        Core.execCommand(`mv "${tempFile}" "${scriptPath}" && chmod +x "${scriptPath}"`, (mvOutput) => {
                            if (mvOutput && mvOutput.includes('ERROR')) {
                                console.error('Failed to move script file:', mvOutput);
                                reject(new Error('脚本文件移动失败: ' + mvOutput));
                            } else {
                                console.log('Script saved successfully:', scriptPath);
                                resolve(scriptPath);
                            }
                        });
                    });
                });
            } catch (error) {
                console.error('Failed to save script to file:', error);
                reject(new Error('脚本保存失败: ' + error.message));
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
        
        try {
            // 直接保存为脚本文件
            const scriptPath = await this.saveScriptToFile(scenario);
            scenario.scriptPath = scriptPath;
            
            // 添加到内存中的情景列表
            this.scenarios.push(scenario);
            
            return scenario;
        } catch (error) {
            throw error;
        }
    }
    
    async updateScenario(scenario) {
        const index = this.scenarios.findIndex(s => s.id === scenario.id);
        if (index >= 0) {
            const originalScenario = this.scenarios[index];
            
            try {
                // 保存更新后的脚本文件
                const scriptPath = await this.saveScriptToFile(scenario);
                scenario.scriptPath = scriptPath;
                
                // 更新内存中的情景
                this.scenarios[index] = scenario;
                
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
            const scriptPath = `${this.scriptsPath}${id}.sh`;
            
            return new Promise((resolve, reject) => {
                // 删除脚本文件
                Core.execCommand(`rm -f "${scriptPath}"`, (output) => {
                    if (output && output.includes('ERROR')) {
                        console.error('Failed to delete script file:', output);
                        reject(new Error('脚本文件删除失败: ' + output));
                    } else {
                        // 从内存中移除情景
                        this.scenarios.splice(index, 1);
                        console.log('Script deleted successfully:', scriptPath);
                        resolve(true);
                    }
                });
            });
        }
        throw new Error('情景不存在');
    }
    
    generateScript(scenario) {
        let script = '#!/system/bin/sh\n\n';
        
        // 添加脚本头部信息
        script += `# Scenario: ${scenario.name}\n`;
        script += `# Compatibility Mode: ${scenario.compatibilityMode}\n`;
        script += `# Auto Reboot: ${scenario.autoReboot ? 'true' : 'false'}\n`;
        script += `# Generated: ${new Date().toISOString()}\n\n`;
        
        // 引入Core.sh并检查是否存在
        script += '# Source Core.sh functions\n';
        script += `CORE_SH="${Core.MODULE_PATH}Core.sh"\n`;
        script += 'if [ ! -f "$CORE_SH" ]; then\n';
        script += '    echo "Error: Core.sh not found at $CORE_SH"\n';
        script += '    exit 1\n';
        script += 'fi\n';
        script += 'source "$CORE_SH"\n\n';
        
        // 设置兼容模式
        if (scenario.compatibilityMode && scenario.compatibilityMode !== 'auto') {
            script += `# Set compatibility mode\n`;
            script += `export COMPATIBILITY_MODE="${scenario.compatibilityMode}"\n`;
        }
        
        script += '\n';
        
        // 设置变量
        script += `# Configuration\n`;
        script += `Installer_Compatibility="${scenario.compatibilityMode ? 'true' : 'false'}"\n`;
        script += `Installer_Log="true"\n\n`;
        
        // 执行操作
        script += `# Execute operations\n`;
        scenario.operations.forEach((operation, index) => {
            script += `log_info "Executing operation ${index + 1}: ${this.getOperationDescription(operation)}"\n`;
            script += this.generateOperationScript(operation);
            script += '\n';
        });
        
        // 自动重启
        if (scenario.autoReboot) {
            script += `# Auto reboot after completion\n`;
            script += `log_info "All operations completed successfully"\n`;
            script += `log_info "Auto reboot enabled, rebooting in 3 seconds..."\n`;
            script += `sleep 3\n`;
            script += `reboot\n`;
        } else {
            script += `# Scenario completion\n`;
            script += `log_info "All operations completed successfully"\n`;
            script += `log_info "Scenario execution finished"\n`;
        }
        
        script += `\nexit 0\n`;        
        return script;
    }
    
    getOperationDescription(operation) {
        switch (operation.type) {
            case 'install_module':
                return `Install module: ${operation.path}`;
            case 'delete_module':
                return `Delete module: ${operation.path}`;
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
        
        script += `# Check if module file exists\n`;
        script += `if [ ! -f "${operation.path}" ]; then\n`;
        script += `    log_error "Module file not found: ${operation.path}"\n`;
        script += `    exit 1\n`;
        script += `fi\n\n`;
        
        script += `# Install module using Core.sh function\n`;
        script += `log_info "Installing module: ${operation.path}"\n`;
        script += `if Installer_Module "${operation.path}"; then\n`;
        script += `    log_info "Module installed successfully"\n`;
        script += `else\n`;
        script += `    log_error "Failed to install module"\n`;
        script += `    exit 1\n`;
        script += `fi\n`;
        
        return script;
    }
    
    generateDeleteModuleScript(operation) {
        let script = '';
        
        if (!operation.path) {
            script += `log_error "Module path not specified"\n`;
            script += `exit 1\n`;
            return script;
        }
        
        script += `# Delete module using Core.sh function\n`;
        script += `log_info "Deleting module: ${operation.path}"\n`;
        script += `if Delete_Module "${operation.path}"; then\n`;
        script += `    log_info "Module deleted successfully"\n`;
        script += `else\n`;
        script += `    log_error "Failed to delete module"\n`;
        script += `    exit 1\n`;
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
        
        script += `# Check if boot image file exists\n`;
        script += `if [ ! -f "${operation.path}" ]; then\n`;
        script += `    log_error "Boot image not found: ${operation.path}"\n`;
        script += `    exit 1\n`;
        script += `fi\n\n`;
        
        script += `# Flash boot image using Core.sh function\n`;
        script += `log_info "Flashing boot image: ${operation.path}"\n`;
        script += `if flash_boot "${operation.path}" "${operation.anykernel ? 'true' : 'false'}"; then\n`;
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
    
    async executeScenario(scenarioId) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            throw new Error('情景不存在');
        }
        
        const scriptPath = `${this.scriptsPath}${scenarioId}.sh`;
        
        return new Promise((resolve, reject) => {
            Core.execCommand(`sh "${scriptPath}"`, (output) => {
                if (output && output.includes('ERROR')) {
                    console.error('Failed to execute scenario script:', output);
                    reject(new Error('脚本执行失败: ' + output));
                } else {
                    console.log('Scenario executed successfully:', output);
                    resolve(output);
                }
            });
        });
    }
    
    exportScenarios() {
        // 导出所有脚本文件的路径列表
        return this.scenarios.map(s => ({
            id: s.id,
            name: s.name,
            scriptPath: s.scriptPath
        }));
    }
    
    async importScenario(scriptPath) {
        // 从外部脚本文件导入情景
        return new Promise((resolve, reject) => {
            const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            const newScriptPath = `${this.scriptsPath}${newId}.sh`;
            
            Core.execCommand(`cp "${scriptPath}" "${newScriptPath}" && chmod +x "${newScriptPath}"`, (output) => {
                if (output && output.includes('ERROR')) {
                    reject(new Error('脚本导入失败: ' + output));
                } else {
                    // 重新加载情景列表
                    this.loadScenarios().then(() => {
                        resolve(true);
                    }).catch(reject);
                }
            });
        });
    }
}