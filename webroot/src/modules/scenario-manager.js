import { Core } from '../core.js';

export class ScenarioManager {
    constructor() {
        this.scenarios = [];
        this.scriptsPath = `/data/adb/switchprofile/scenarios/`;
        this.exportPath = '/sdcard/Download/';
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
        if (Core.isDebugMode()) {
            Core.logDebug(`开始解析脚本文件: ${scriptPath}`, 'PARSE');
        }
        
        Core.execCommand(`head -20 "${scriptPath}"`, (output) => {
            try {
                if (output && !output.includes('ERROR')) {
                    const lines = output.split('\n');
                    
                    const scenario = {
                        id: this.extractScriptId(scriptPath),
                        name: this.extractMetadata(lines, 'Generated scenario script:') || Core.t('scenario.unknownName'),
                        compatibilityMode: this.extractMetadata(lines, 'Installer_Compatibility=') === 'true',
                        autoReboot: this.checkAutoReboot(lines),
                        operations: this.extractOperations(lines),
                        scriptPath: scriptPath
                    };
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`解析完成: ${scenario.name} (${scenario.operations.length}个操作)`, 'PARSE');
                    }
                    
                    this.scenarios.push(scenario);
                } else {
                    if (Core.isDebugMode()) {
                        Core.logDebug(`脚本文件读取失败: ${scriptPath}`, 'ERROR');
                    }
                }
            } catch (error) {
                console.warn('Failed to parse script file:', scriptPath, error);
                if (Core.isDebugMode()) {
                    Core.logDebug(`脚本解析异常: ${error.message}`, 'ERROR');
                }
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
        const operations = [];
        let operationNumber = 0;
        
        lines.forEach((line, index) => {
            // 检查操作标记注释
            if (line.startsWith('# Operation ')) {
                operationNumber++;
                
                // 查找下一行的实际操作命令
                for (let i = index + 1; i < Math.min(index + 5, lines.length); i++) {
                    const nextLine = lines[i].trim();
                    
                    if (nextLine.startsWith('Installer_Module ')) {
                        const pathMatch = nextLine.match(/Installer_Module "([^"]+)"/);
                        const operation = { 
                            type: 'install_module', 
                            path: pathMatch ? pathMatch[1] : 'unknown',
                            operationNumber: operationNumber
                        };
                        operations.push(operation);
                        break;
                    } else if (nextLine.startsWith('Delete_Module ')) {
                        const pathMatch = nextLine.match(/Delete_Module "([^"]+)"/);
                        const operation = { 
                            type: 'delete_module', 
                            path: pathMatch ? pathMatch[1] : 'unknown',
                            operationNumber: operationNumber
                        };
                        operations.push(operation);
                        break;
                    } else if (nextLine.startsWith('flash_boot ')) {
                        const pathMatch = nextLine.match(/flash_boot "([^"]+)" "([^"]+)"/);
                        const operation = { 
                            type: 'flash_boot', 
                            path: pathMatch ? pathMatch[1] : 'unknown',
                            anykernel: pathMatch ? pathMatch[2] === 'true' : false,
                            operationNumber: operationNumber
                        };
                        operations.push(operation);
                        break;
                    } else if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('log_') && !nextLine.startsWith('report_progress')) {
                        // 自定义脚本
                        const operation = { 
                            type: 'custom_script', 
                            script: nextLine,
                            operationNumber: operationNumber
                        };
                        operations.push(operation);
                        break;
                    }
                }
            }
        });
        
        if (Core.isDebugMode()) {
            Core.logDebug(`操作提取完成，共提取到 ${operations.length} 个操作`, 'EXTRACT');
        }
        
        return operations;
    }
    
    async saveScriptToFile(scenario) {
        return new Promise((resolve, reject) => {
            try {
                const scriptPath = `${this.scriptsPath}${scenario.id}.sh`;
                const scriptContent = this.generateScript(scenario);
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`开始保存脚本文件: ${scriptPath}`, 'SAVE');
                    Core.logDebug(`脚本内容长度: ${scriptContent.length} 字符`, 'SAVE');
                    Core.showToast(`[DEBUG] 保存脚本: ${scenario.name}`, 'info');
                }
                
                // 确保脚本目录存在
                Core.execCommand(`mkdir -p "${this.scriptsPath}"`, (mkdirOutput) => {
                    if (mkdirOutput && mkdirOutput.includes('ERROR')) {
                        console.error('Failed to create scripts directory:', mkdirOutput);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`脚本目录创建失败: ${mkdirOutput}`, 'ERROR');
                            Core.showToast(`[DEBUG] 目录创建失败: ${mkdirOutput}`, 'error');
                        }
                        reject(new Error('脚本目录创建失败: ' + mkdirOutput));
                        return;
                    }
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`脚本目录创建成功: ${this.scriptsPath}`, 'SAVE');
                    }
                    
                    // 写入脚本文件
                    const tempFile = `${scriptPath}.tmp`;
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`开始写入临时文件: ${tempFile}`, 'SAVE');
                    }
                    
                    Core.execCommand(`cat > "${tempFile}" << 'EOF'\n${scriptContent}\nEOF`, (writeOutput) => {
                        if (writeOutput && writeOutput.includes('ERROR')) {
                            console.error('Failed to write temp script file:', writeOutput);
                            if (Core.isDebugMode()) {
                                Core.logDebug(`临时文件写入失败: ${writeOutput}`, 'ERROR');
                                Core.showToast(`[DEBUG] 文件写入失败: ${writeOutput}`, 'error');
                            }
                            reject(new Error('临时脚本文件写入失败: ' + writeOutput));
                            return;
                        }
                        
                        if (Core.isDebugMode()) {
                            Core.logDebug(`临时文件写入成功: ${tempFile}`, 'SAVE');
                        }
                        
                        // 移动临时文件到目标位置并设置执行权限
                        Core.execCommand(`mv "${tempFile}" "${scriptPath}" && chmod +x "${scriptPath}"`, (mvOutput) => {
                            if (mvOutput && mvOutput.includes('ERROR')) {
                                console.error('Failed to move script file:', mvOutput);
                                if (Core.isDebugMode()) {
                                    Core.logDebug(`脚本文件移动失败: ${mvOutput}`, 'ERROR');
                                    Core.showToast(`[DEBUG] 文件移动失败: ${mvOutput}`, 'error');
                                }
                                reject(new Error('脚本文件移动失败: ' + mvOutput));
                            } else {
                                console.log('Script saved successfully:', scriptPath);
                                if (Core.isDebugMode()) {
                                    Core.logDebug(`脚本保存成功: ${scriptPath}`, 'SAVE');
                                    Core.showToast(`[DEBUG] 脚本保存成功: ${scenario.name}`, 'success');
                                }
                                resolve(scriptPath);
                            }
                        });
                    });
                });
            } catch (error) {
                console.error('Failed to save script to file:', error);
                if (Core.isDebugMode()) {
                    Core.logDebug(`脚本保存异常: ${error.message}`, 'ERROR');
                    Core.showToast(`[DEBUG] 保存异常: ${error.message}`, 'error');
                }
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

    // 导出情景到指定路径
    async exportScenario(scenarioId, exportPath) {
        return new Promise((resolve, reject) => {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) {
                if (Core.isDebugMode()) {
                    Core.logDebug(`导出失败: 情景不存在 (ID: ${scenarioId})`, 'EXPORT');
                    Core.showToast(`[DEBUG] 导出失败: 情景不存在`, 'error');
                }
                Core.showToast(Core.t('toast.scenario.notFound'), 'error');
                reject(new Error('情景不存在'));
                return;
            }

            if (Core.isDebugMode()) {
                Core.logDebug(`开始导出情景: ${scenario.name} (ID: ${scenarioId}) 到 ${exportPath}`, 'EXPORT');
                Core.showToast(`[DEBUG] 导出情景: ${scenario.name}`, 'info');
            }

            const sourceFile = `${this.scriptsPath}${scenarioId}.sh`;
            const targetFile = `${exportPath}/${scenario.name}_${scenarioId}.sh`;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`源文件: ${sourceFile}, 目标文件: ${targetFile}`, 'EXPORT');
            }
            
            // 确保目标目录存在
            Core.execCommand(`mkdir -p "${exportPath}"`, (mkdirOutput) => {
                if (mkdirOutput && mkdirOutput.includes('ERROR')) {
                    if (Core.isDebugMode()) {
                        Core.logDebug(`创建导出目录失败: ${mkdirOutput}`, 'ERROR');
                        Core.showToast(`[DEBUG] 目录创建失败: ${mkdirOutput}`, 'error');
                    }
                    Core.showToast(Core.t('toast.scenario.createExportDirFailed'), 'error');
                    reject(new Error('创建导出目录失败'));
                    return;
                }
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`导出目录创建成功: ${exportPath}`, 'EXPORT');
                }
                
                // 复制文件
                Core.execCommand(`cp "${sourceFile}" "${targetFile}"`, (cpOutput) => {
                    if (cpOutput && cpOutput.includes('ERROR')) {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`文件复制失败: ${cpOutput}`, 'ERROR');
                            Core.showToast(`[DEBUG] 文件复制失败: ${cpOutput}`, 'error');
                        }
                        Core.showToast(Core.t('toast.scenario.exportFileFailed'), 'error');
                        reject(new Error('导出文件失败'));
                    } else {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`情景导出成功: ${targetFile}`, 'EXPORT');
                            Core.showToast(`[DEBUG] 导出成功: ${scenario.name}`, 'success');
                        }
                        Core.showToast(`情景导出成功: ${targetFile}`, 'success');
                        resolve(targetFile);
                    }
                });
            });
        });
    }

    // 从指定路径导入情景
    async importScenario(importPath) {
        return new Promise((resolve, reject) => {
            if (Core.isDebugMode()) {
                Core.logDebug(`开始导入情景: ${importPath}`, 'IMPORT');
                Core.showToast(`[DEBUG] 导入情景: ${importPath}`, 'info');
            }
            
            Core.showToast(`开始导入情景: ${importPath}`, 'info');
            // 检查文件是否存在
            Core.execCommand(`test -f "${importPath}" && echo "exists"`, (testOutput) => {
                if (!testOutput || !testOutput.includes('exists')) {
                    if (Core.isDebugMode()) {
                        Core.logDebug(`导入文件不存在: ${importPath}`, 'ERROR');
                        Core.showToast(`[DEBUG] 文件不存在: ${importPath}`, 'error');
                    }
                    Core.showToast(Core.t('toast.scenario.importFileNotFound'), 'error');
                    reject(new Error('导入文件不存在'));
                    return;
                }
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`导入文件存在，开始处理: ${importPath}`, 'IMPORT');
                }
                
                // 生成新的情景ID
                const newId = Date.now().toString();
                const targetFile = `${this.scriptsPath}${newId}.sh`;
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`生成新ID: ${newId}, 目标文件: ${targetFile}`, 'IMPORT');
                }
                
                // 确保脚本目录存在
                Core.execCommand(`mkdir -p "${this.scriptsPath}"`, (mkdirOutput) => {
                    if (mkdirOutput && mkdirOutput.includes('ERROR')) {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`创建脚本目录失败: ${mkdirOutput}`, 'ERROR');
                            Core.showToast(`[DEBUG] 目录创建失败: ${mkdirOutput}`, 'error');
                        }
                        Core.showToast(Core.t('toast.scenario.createScriptDirFailed'), 'error');
                        reject(new Error('创建脚本目录失败'));
                        return;
                    }
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`脚本目录创建成功: ${this.scriptsPath}`, 'IMPORT');
                    }
                    
                    // 复制文件到脚本目录
                    Core.execCommand(`cp "${importPath}" "${targetFile}"`, (cpOutput) => {
                        if (cpOutput && cpOutput.includes('ERROR')) {
                            if (Core.isDebugMode()) {
                                Core.logDebug(`文件复制失败: ${cpOutput}`, 'ERROR');
                                Core.showToast(`[DEBUG] 文件复制失败: ${cpOutput}`, 'error');
                            }
                            Core.showToast(Core.t('toast.scenario.importFileFailed'), 'error');
                            reject(new Error('导入文件失败'));
                        } else {
                            if (Core.isDebugMode()) {
                                Core.logDebug(`文件复制成功，开始解析脚本: ${targetFile}`, 'IMPORT');
                            }
                            
                            // 解析导入的脚本文件
                            this.parseScriptFile(targetFile, () => {
                                if (Core.isDebugMode()) {
                                    Core.logDebug(`情景导入成功，新ID: ${newId}`, 'IMPORT');
                                    Core.showToast(`[DEBUG] 导入成功，ID: ${newId}`, 'success');
                                }
                                Core.showToast(Core.t('toast.scenario.importSuccess'), 'success');
                                resolve(newId);
                            });
                        }
                    });
                });
            });
        });
    }

    // 批量导出所有情景
    async exportAllScenarios(exportPath) {
        const results = [];
        for (const scenario of this.scenarios) {
            try {
                const result = await this.exportScenario(scenario.id, exportPath);
                results.push({ success: true, scenario: scenario.name, file: result });
            } catch (error) {
                results.push({ success: false, scenario: scenario.name, error: error.message });
            }
        }
        return results;
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
            
            Core.showToast(`情景添加成功: ${scenario.name}`, 'success');
            return scenario;
        } catch (error) {
            Core.showToast(`情景添加失败: ${error.message}`, 'error');
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
                
                Core.showToast(`情景更新成功: ${scenario.name}`, 'success');
                return true;
            } catch (error) {
                // 如果保存失败，回滚操作
                this.scenarios[index] = originalScenario;
                Core.showToast(`情景更新失败: ${error.message}`, 'error');
                throw error;
            }
        }
        Core.showToast(Core.t('toast.scenario.notFound'), 'error');
        throw new Error('情景不存在');
    }
    
    async deleteScenario(id) {
        const index = this.scenarios.findIndex(s => s.id === id);
        if (index >= 0) {
            const deletedScenario = this.scenarios[index];
            const scriptPath = `${this.scriptsPath}${id}.sh`;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`开始删除情景: ${deletedScenario.name} (ID: ${id})`, 'DELETE');
                Core.logDebug(`脚本文件路径: ${scriptPath}`, 'DELETE');
                Core.showToast(`[DEBUG] 删除情景: ${deletedScenario.name}`, 'info');
            }
            
            return new Promise((resolve, reject) => {
                // 删除脚本文件
                Core.execCommand(`rm -f "${scriptPath}"`, (output) => {
                    if (output && output.includes('ERROR')) {
                        console.error('Failed to delete script file:', output);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`脚本文件删除失败: ${output}`, 'ERROR');
                            Core.showToast(`[DEBUG] 文件删除失败: ${output}`, 'error');
                        }
                        Core.showToast(`脚本文件删除失败: ${output}`, 'error');
                        reject(new Error('脚本文件删除失败: ' + output));
                    } else {
                        // 从内存中移除情景
                        this.scenarios.splice(index, 1);
                        console.log('Script deleted successfully:', scriptPath);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`情景删除成功: ${deletedScenario.name}`, 'DELETE');
                            Core.showToast(`[DEBUG] 删除成功: ${deletedScenario.name}`, 'success');
                        }
                        Core.showToast(`情景删除成功: ${deletedScenario.name}`, 'success');
                        resolve(true);
                    }
                });
            });
        }
        if (Core.isDebugMode()) {
            Core.logDebug(`删除失败: 情景不存在 (ID: ${id})`, 'ERROR');
            Core.showToast(`[DEBUG] 情景不存在: ${id}`, 'error');
        }
        Core.showToast(Core.t('toast.scenario.notFound'), 'error');
        throw new Error('情景不存在');
    }
    
    generateScript(scenario) {
        if (Core.isDebugMode()) {
            Core.logDebug(`开始生成脚本: ${scenario.name}`, 'GENERATE');
            Core.showToast(`[DEBUG] 生成脚本: ${scenario.name}`, 'info');
        }
        
        let script = '#!/system/bin/sh\n\n';
        
        // 基本设置和元数据标识
        script += `# Generated scenario script: ${scenario.name}\n`;
        script += `source "${Core.MODULE_PATH}Core.sh"\n`;
        script += `Installer_Compatibility="${scenario.compatibilityMode ? 'true' : 'false'}"\n`;
        script += `Installer_Log="true"\n\n`;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`脚本头部生成完成，兼容模式: ${scenario.compatibilityMode}`, 'GENERATE');
        }
        
        // 进度报告函数
        script += 'report_progress() {\n';
        script += '    echo "PROGRESS:$1:$2:$3"\n';
        script += '}\n\n';
        
        script += `log_info "Starting scenario: ${scenario.name}"\n`;
        script += `report_progress "0" "${scenario.operations.length}" "开始执行情景"\n\n`;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`开始生成 ${scenario.operations.length} 个操作的脚本`, 'GENERATE');
        }
        
        // 生成操作脚本
        scenario.operations.forEach((operation, index) => {
            const operationNumber = index + 1;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`生成操作 ${operationNumber}: ${JSON.stringify(operation)}`, 'GENERATE');
            }
            
            script += `# Operation ${operationNumber}\n`;
            script += `log_info "[${operationNumber}/${scenario.operations.length}] ${this.getOperationDescription(operation)}"\n`;
            script += `report_progress "${index}" "${scenario.operations.length}" "${this.getOperationDescription(operation)}"\n`;
            
            // 生成具体操作脚本
            const operationScript = this.generateOperationScript(operation, operationNumber);
            script += operationScript;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`操作 ${operationNumber} 脚本生成: ${operationScript.trim()}`, 'GENERATE');
            }
            
            script += `report_progress "${operationNumber}" "${scenario.operations.length}" "操作 ${operationNumber} 完成"\n\n`;
        });
        
        // 完成
        script += `log_info "All operations completed successfully"\n`;
        script += `report_progress "${scenario.operations.length}" "${scenario.operations.length}" "所有操作完成"\n`;
        
        // 自动重启
        if (scenario.autoReboot) {
            script += '\nlog_info "Auto reboot in 3 seconds..."\n';
            script += 'sleep 3\n';
            script += 'reboot\n';
            
            if (Core.isDebugMode()) {
                Core.logDebug('添加自动重启脚本', 'GENERATE');
            }
        }
        
        script += '\nexit 0\n';
        
        if (Core.isDebugMode()) {
            Core.logDebug(`脚本生成完成，总长度: ${script.length} 字符`, 'GENERATE');
            Core.showToast(`[DEBUG] 脚本生成完成: ${scenario.operations.length}个操作`, 'success');
        }
        
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
    
    generateOperationId(operation, index) {
        // 生成唯一的操作标识符，用于脚本中的标记和错误处理
        const typePrefix = {
            'install_module': 'INST',
            'delete_module': 'DEL',
            'flash_boot': 'FLASH',
            'custom_script': 'CUSTOM'
        }[operation.type] || 'UNK';
        
        const timestamp = Date.now().toString().slice(-6); // 取时间戳后6位
        return `${typePrefix}_${String(index + 1).padStart(3, '0')}_${timestamp}`;
    }
    

    

    
    generateOperationScript(operation, operationNumber) {
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
                return `log_error "Unknown operation type: ${operation.type}"\nexit 1\n`;
        }
    }
    
    generateInstallModuleScript(operation) {
        if (!operation.path) {
            return `log_error "Module path not specified"\nexit 1\n`;
        }
        
        return `Installer_Module "${operation.path}" || exit 1\n`;
    }
    
    generateDeleteModuleScript(operation) {
        if (!operation.path) {
            return `log_error "Module path not specified"\nexit 1\n`;
        }
        
        return `Delete_Module "${operation.path}" || exit 1\n`;
    }
    
    generateFlashBootScript(operation) {
        if (!operation.path) {
            return `log_error "Boot image path not specified"\nexit 1\n`;
        }
        
        return `flash_boot "${operation.path}" "${operation.anykernel ? 'true' : 'false'}" || exit 1\n`;
    }
    
    generateCustomScript(operation) {
        if (!operation.script || operation.script.trim() === '') {
            return `log_error "Custom script content is empty"\nexit 1\n`;
        }
        
        return operation.script + '\n';
    }
    
    async executeScenario(scenarioId) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            if (Core.isDebugMode()) {
                Core.logDebug(`执行失败: 情景不存在 (ID: ${scenarioId})`, 'ERROR');
                Core.showToast(`[DEBUG] 情景不存在: ${scenarioId}`, 'error');
            }
            Core.showToast(Core.t('toast.scenario.notFound'), 'error');
            throw new Error('情景不存在');
        }
        
        if (Core.isDebugMode()) {
            Core.logDebug(`开始执行情景: ${scenario.name} (ID: ${scenarioId})`, 'EXECUTE');
            Core.logDebug(`情景包含 ${scenario.operations.length} 个操作`, 'EXECUTE');
            Core.showToast(`[DEBUG] 执行情景: ${scenario.name}`, 'info');
        }
        
        Core.showToast(`开始执行情景: ${scenario.name}`, 'info');
        const scriptPath = `${this.scriptsPath}${scenarioId}.sh`;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`脚本路径: ${scriptPath}`, 'EXECUTE');
        }
        
        return new Promise((resolve, reject) => {
            Core.execCommand(`sh "${scriptPath}"`, (output) => {
                if (output && output.includes('ERROR')) {
                    console.error('Failed to execute scenario script:', output);
                    if (Core.isDebugMode()) {
                        Core.logDebug(`情景执行失败: ${output}`, 'ERROR');
                        Core.showToast(`[DEBUG] 执行失败: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`, 'error');
                    }
                    Core.showToast(`情景执行失败: ${output}`, 'error');
                    reject(new Error('脚本执行失败: ' + output));
                } else {
                    console.log('Scenario executed successfully:', output);
                    if (Core.isDebugMode()) {
                        Core.logDebug(`情景执行成功: ${scenario.name}`, 'EXECUTE');
                        Core.logDebug(`执行输出长度: ${output ? output.length : 0} 字符`, 'EXECUTE');
                        if (output && output.length > 0) {
                            Core.logDebug(`执行输出内容: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}`, 'EXECUTE');
                        }
                        Core.showToast(`[DEBUG] 执行成功: ${scenario.name}`, 'success');
                    }
                    Core.showToast(`情景执行成功: ${scenario.name}`, 'success');
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
    
    // 操作管理方法 - 确保安全的插入、删除和修改
    
    insertOperation(scenarioId, operation, position = -1) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            throw new Error('情景不存在');
        }
        
        // 验证操作数据
        if (!this.validateOperation(operation)) {
            throw new Error('操作数据无效');
        }
        
        // 确保位置有效
        const targetPosition = position === -1 ? scenario.operations.length : Math.max(0, Math.min(position, scenario.operations.length));
        
        // 插入操作
        scenario.operations.splice(targetPosition, 0, operation);
        
        // 重新生成操作编号和标识符
        this.renumberOperations(scenario);
        
        // 保存更新后的情景
        return this.updateScenario(scenarioId, scenario);
    }
    
    deleteOperation(scenarioId, operationIndex) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            throw new Error('情景不存在');
        }
        
        if (operationIndex < 0 || operationIndex >= scenario.operations.length) {
            throw new Error('操作索引无效');
        }
        
        // 删除操作
        scenario.operations.splice(operationIndex, 1);
        
        // 重新生成操作编号和标识符
        this.renumberOperations(scenario);
        
        // 保存更新后的情景
        return this.updateScenario(scenarioId, scenario);
    }
    
    moveOperation(scenarioId, fromIndex, toIndex) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            throw new Error('情景不存在');
        }
        
        if (fromIndex < 0 || fromIndex >= scenario.operations.length || 
            toIndex < 0 || toIndex >= scenario.operations.length) {
            throw new Error('操作索引无效');
        }
        
        // 移动操作
        const operation = scenario.operations.splice(fromIndex, 1)[0];
        scenario.operations.splice(toIndex, 0, operation);
        
        // 重新生成操作编号和标识符
        this.renumberOperations(scenario);
        
        // 保存更新后的情景
        return this.updateScenario(scenarioId, scenario);
    }
    
    modifyOperation(scenarioId, operationIndex, newOperation) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            throw new Error('情景不存在');
        }
        
        if (operationIndex < 0 || operationIndex >= scenario.operations.length) {
            throw new Error('操作索引无效');
        }
        
        // 验证新操作数据
        if (!this.validateOperation(newOperation)) {
            throw new Error('操作数据无效');
        }
        
        // 修改操作
        scenario.operations[operationIndex] = { ...newOperation };
        
        // 重新生成操作编号和标识符
        this.renumberOperations(scenario);
        
        // 保存更新后的情景
        return this.updateScenario(scenarioId, scenario);
    }
    
    validateOperation(operation) {
        if (!operation || typeof operation !== 'object') {
            return false;
        }
        
        // 检查操作类型
        const validTypes = ['install_module', 'delete_module', 'flash_boot', 'custom_script'];
        if (!validTypes.includes(operation.type)) {
            return false;
        }
        
        // 根据操作类型验证必需字段
        switch (operation.type) {
            case 'install_module':
            case 'delete_module':
                return operation.path && typeof operation.path === 'string' && operation.path.trim() !== '';
                
            case 'flash_boot':
                return operation.path && typeof operation.path === 'string' && operation.path.trim() !== '';
                
            case 'custom_script':
                return operation.script && typeof operation.script === 'string' && operation.script.trim() !== '';
                
            default:
                return false;
        }
    }
    
    renumberOperations(scenario) {
        // 重新为所有操作分配编号和生成标识符
        scenario.operations.forEach((operation, index) => {
            operation.index = index;
            operation.number = index + 1;
            // 为操作添加时间戳以确保唯一性
            if (!operation.timestamp) {
                operation.timestamp = Date.now();
            }
        });
    }
    
    getOperationSafetyInfo(operation) {
        // 获取操作的安全性信息
        const safetyInfo = {
            riskLevel: 'low',
            warnings: [],
            requirements: []
        };
        
        switch (operation.type) {
            case 'install_module':
                safetyInfo.riskLevel = 'medium';
                safetyInfo.warnings.push('模块安装可能影响系统稳定性');
                safetyInfo.requirements.push('确保模块文件完整且兼容');
                break;
                
            case 'delete_module':
                safetyInfo.riskLevel = 'medium';
                safetyInfo.warnings.push('删除模块可能导致功能缺失');
                safetyInfo.requirements.push('确认模块可以安全删除');
                break;
                
            case 'flash_boot':
                safetyInfo.riskLevel = 'high';
                safetyInfo.warnings.push('刷入Boot镜像有变砖风险');
                safetyInfo.requirements.push('确保Boot镜像正确且兼容设备');
                safetyInfo.requirements.push('建议在刷入前创建备份');
                break;
                
            case 'custom_script':
                safetyInfo.riskLevel = 'high';
                safetyInfo.warnings.push('自定义脚本可能执行危险操作');
                safetyInfo.requirements.push('仔细检查脚本内容');
                safetyInfo.requirements.push('确保脚本来源可信');
                break;
        }
        
        return safetyInfo;
    }
}