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
                Core.execCommand(`mkdir -p "${this.scriptsPath}"`, (mkdirOutput, isSuccess, details) => {
                    if (!isSuccess || (mkdirOutput && mkdirOutput.includes('ERROR'))) {
                        console.warn('Failed to create scripts directory:', mkdirOutput);
                    }
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Start scanning script directory: ${this.scriptsPath}`, 'LOAD');
                    }
                    
                    // 使用find命令搜索脚本文件
                    Core.execCommand(`find "${this.scriptsPath}" -name "*.sh" -type f 2>/dev/null || echo "NO_FILES"`, (output, isSuccess, details) => {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Directory scan result: ${output}`, 'LOAD');
                        }
                        
                        if (output && output.trim() !== 'NO_FILES' && !output.includes('No such file') && !output.includes('ERROR')) {
                            // 处理文件列表，过滤空行和无效路径
                            const scriptFiles = output.trim().split('\n')
                                .map(file => file.trim())
                                .filter(file => {
                                    const isValid = file && file.endsWith('.sh') && !file.includes('No such file') && file.includes(this.scriptsPath);
                                    if (Core.isDebugMode() && !isValid && file) {
                                        Core.logDebug(`Filtered out invalid file: ${file}`, 'LOAD');
                                    }
                                    return isValid;
                                });
                            
                            if (Core.isDebugMode()) {
                                Core.logDebug(`Found ${scriptFiles.length} valid script files: ${JSON.stringify(scriptFiles)}`, 'LOAD');
                            }
                            
                            this.scenarios = [];
                            
                            let loadedCount = 0;
                            const totalFiles = scriptFiles.length;
                            
                            if (totalFiles === 0) {
                                if (Core.isDebugMode()) {
                                    Core.logDebug('No script files found', 'LOAD');
                                }
                                resolve();
                                return;
                            }
                            
                            scriptFiles.forEach(scriptPath => {
                                // 验证文件是否真实存在
                                Core.execCommand(`test -f "${scriptPath}" && echo "EXISTS" || echo "NOT_EXISTS"`, (testOutput, isSuccess, details) => {
                                    if (testOutput && testOutput.trim() === 'EXISTS') {
                                        this.parseScriptFile(scriptPath, () => {
                                            loadedCount++;
                                            if (loadedCount === totalFiles) {
                                                if (Core.isDebugMode()) {
                                                    Core.logDebug(`Script loading completed, loaded ${this.scenarios.length} scenarios`, 'LOAD');
                                                }
                                                resolve();
                                            }
                                        });
                                    } else {
                                        if (Core.isDebugMode()) {
                                            Core.logDebug(`File does not exist, skip: ${scriptPath}`, 'LOAD');
                                        }
                                        loadedCount++;
                                        if (loadedCount === totalFiles) {
                                            resolve();
                                        }
                                    }
                                });
                            });
                        } else {
                            if (Core.isDebugMode()) {
                                Core.logDebug('Directory is empty or scan failed', 'LOAD');
                            }
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.warn('Failed to load scenarios from script files:', error);
                if (Core.isDebugMode()) {
                    Core.logDebug(`Script loading error: ${error.message}`, 'ERROR');
                }
                reject(error);
            }
        });
    }
    
    parseScriptFile(scriptPath, callback) {
        if (Core.isDebugMode()) {
            Core.logDebug(`Start parsing script file: ${scriptPath}`, 'PARSE');
        }
        
        // 读取完整的脚本文件内容，确保能解析所有操作
        Core.execCommand(`cat "${scriptPath}" 2>/dev/null`, (output, isSuccess, details) => {
            try {
                // 使用新的错误检测机制，优先使用ksu返回的成功状态
                if (isSuccess && output && !output.includes('ERROR') && output.trim()) {
                    const lines = output.split('\n').filter(line => line !== undefined);
                    const scriptId = this.extractScriptId(scriptPath);
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Script content lines: ${lines.length}, script ID: ${scriptId}`, 'PARSE');
                    }
                    
                    const scenario = {
                        id: scriptId,
                        name: this.extractMetadata(lines, 'name') || 
                              this.extractMetadata(lines, 'Name:') || 
                              this.extractMetadata(lines, 'Generated scenario script:') || 
                              scriptId,
                        description: this.extractMetadata(lines, 'description') || 
                                   this.extractMetadata(lines, 'Description:') || '',
                        author: this.extractMetadata(lines, 'author') || 
                               this.extractMetadata(lines, 'Author:') || '',
                        version: this.extractMetadata(lines, 'version') || 
                                this.extractMetadata(lines, 'Version:') || '1.0',
                        compatibilityMode: this.extractMetadata(lines, 'Installer_Compatibility') === 'true' ||
                                         lines.some(line => line.includes('Installer_Compatibility="true"')),
                        autoReboot: this.checkAutoReboot(lines),
                        operations: this.extractOperations(lines),
                        scriptPath: scriptPath
                    };
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Parsed scenario: ${JSON.stringify({
                            id: scenario.id,
                            name: scenario.name,
                            operationsCount: scenario.operations.length,
                            compatibilityMode: scenario.compatibilityMode,
                            autoReboot: scenario.autoReboot
                        })}`, 'PARSE');
                    }
                    
                    // 验证情景是否有效
                    const hasValidName = scenario.name && scenario.name !== scriptId;
                    const hasOperations = scenario.operations.length > 0;
                    const hasShellCommands = lines.some(line => {
                        const trimmed = line.trim();
                        return trimmed && !trimmed.startsWith('#') && 
                               (trimmed.includes('Installer_Module') || 
                                trimmed.includes('Delete_Module') || 
                                trimmed.includes('flash_boot') || 
                                (trimmed.length > 0 && !trimmed.startsWith('log_') && !trimmed.startsWith('report_progress')));
                    });
                    
                    const isValidScript = hasValidName || hasOperations || hasShellCommands;
                    
                    if (isValidScript) {
                        this.scenarios.push(scenario);
                        
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Successfully parsed script: ${scenario.name} (${scenario.id}), operations: ${scenario.operations.length}`, 'PARSE');
                        }
                    } else {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Skip invalid script: ${scriptPath} - empty file or comments only`, 'PARSE');
                        }
                    }
                } else {
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Cannot read script file content: ${scriptPath}`, 'ERROR');
                    }
                }
            } catch (error) {
                console.warn('Failed to parse script file:', scriptPath, error);
                if (Core.isDebugMode()) {
                    Core.logDebug(`Script parsing error: ${error.message}`, 'ERROR');
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
        // 尝试多种注释格式，优先匹配标准格式
        const patterns = [
            new RegExp(`^#\s*${prefix}\s*:\s*(.+)$`, 'i'),     // # name: value (标准格式)
            new RegExp(`^#\s*${prefix}\s*=\s*(.+)$`, 'i'),     // # name = value
            new RegExp(`^#\s*${prefix}\s+(.+)$`, 'i'),          // # name value
            new RegExp(`#\s*${prefix}\s*[:=]?\s*(.+)`, 'i'),   // 任意位置的 # name: value
            new RegExp(`${prefix}\s*[:=]?\s*(.+)`, 'i'),        // name: value (无#)
            new RegExp(`${prefix}(.+)`, 'i')                     // namevalue (原始格式)
        ];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            for (const pattern of patterns) {
                const match = trimmedLine.match(pattern);
                if (match && match[1]) {
                    let value = match[1].trim();
                    // 移除引号
                    value = value.replace(/^["']|["']$/g, '');
                    // 移除尾部注释
                    const commentIndex = value.indexOf('#');
                    if (commentIndex > 0) {
                        value = value.substring(0, commentIndex).trim();
                    }
                    if (value) {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Extract metadata ${prefix}: ${value} (from: ${trimmedLine})`, 'PARSE');
                        }
                        return value;
                    }
                }
            }
        }
        
        return null;
    }
    
    checkAutoReboot(lines) {
        return lines.some(line => line.includes('reboot') && !line.startsWith('#'));
    }
    
    extractOperations(lines) {
        const operations = [];
        let operationNumber = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检查操作标记注释
            if (line.startsWith('# Operation ')) {
                operationNumber++;
                
                // 查找下一行的实际操作命令，跳过日志和进度报告行
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    const nextLine = lines[j].trim();
                    
                    // 跳过日志和进度报告行
                    if (nextLine.startsWith('log_') || nextLine.startsWith('report_progress') || 
                        nextLine.startsWith('#') || nextLine === '') {
                        continue;
                    }
                    
                    // 解析不同类型的操作
                    if (nextLine.startsWith('Installer_Module ')) {
                        const pathMatch = nextLine.match(/Installer_Module "([^"]+)"/);
                        const operation = { 
                            type: 'install_module', 
                            path: pathMatch ? pathMatch[1] : 'unknown',
                            operationNumber: operationNumber
                        };
                        operations.push(operation);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Extracted install_module operation: ${operation.path}`, 'EXTRACT');
                        }
                        break;
                    } else if (nextLine.startsWith('Delete_Module ')) {
                        const pathMatch = nextLine.match(/Delete_Module "([^"]+)"/);
                        const operation = { 
                            type: 'delete_module', 
                            path: pathMatch ? pathMatch[1] : 'unknown',
                            operationNumber: operationNumber
                        };
                        operations.push(operation);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Extracted delete_module operation: ${operation.path}`, 'EXTRACT');
                        }
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
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Extracted flash_boot operation: ${operation.path}, anykernel: ${operation.anykernel}`, 'EXTRACT');
                        }
                        break;
                    } else {
                        // 自定义脚本 - 收集多行脚本内容
                        let scriptLines = [nextLine];
                        let k = j + 1;
                        
                        // 继续收集脚本行，直到遇到下一个操作或脚本结束
                        while (k < lines.length) {
                            const scriptLine = lines[k].trim();
                            if (scriptLine.startsWith('# Operation ') || 
                                scriptLine.startsWith('log_info "All operations completed') ||
                                scriptLine.startsWith('report_progress "' + operationNumber)) {
                                break;
                            }
                            if (scriptLine && !scriptLine.startsWith('log_') && 
                                !scriptLine.startsWith('report_progress')) {
                                scriptLines.push(scriptLine);
                            }
                            k++;
                        }
                        
                        const operation = { 
                            type: 'custom_script', 
                            script: scriptLines.join('\n'),
                            operationNumber: operationNumber
                        };
                        operations.push(operation);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Extracted custom_script operation: ${scriptLines.length} lines`, 'EXTRACT');
                        }
                        break;
                    }
                }
            }
        }
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Operation extraction completed, extracted ${operations.length} operations`, 'EXTRACT');
        }
        
        return operations;
    }
    
    async saveScriptToFile(scenario) {
        return new Promise((resolve, reject) => {
            try {
                const scriptPath = `${this.scriptsPath}${scenario.id}.sh`;
                const scriptContent = this.generateScript(scenario);
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`Start saving script file: ${scriptPath}`, 'SAVE');
                    Core.logDebug(`Script content length: ${scriptContent.length} characters`, 'SAVE');
                    Core.showToast(`[DEBUG] Saving script: ${scenario.name}`, 'info');
                }
                
                // 确保脚本目录存在
                Core.execCommand(`mkdir -p "${this.scriptsPath}"`, (mkdirOutput, isSuccess, details) => {
                    if (!isSuccess || (mkdirOutput && mkdirOutput.includes('ERROR'))) {
                        console.error('Failed to create scripts directory:', mkdirOutput);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Script directory creation failed: ${mkdirOutput}`, 'ERROR');
                            Core.showToast(`[DEBUG] Failed to create directory: ${mkdirOutput}`, 'error');
                        }
                        reject(new Error('Failed to create script directory: ' + mkdirOutput));
                        return;
                    }
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Script directory created successfully: ${this.scriptsPath}`, 'SAVE');
                    }
                    
                    // 写入脚本文件
                    const tempFile = `${scriptPath}.tmp`;
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Start writing temporary file: ${tempFile}`, 'SAVE');
                    }
                    
                    Core.execCommand(`cat > "${tempFile}" << 'EOF'\n${scriptContent}\nEOF`, (writeOutput, isSuccess, details) => {
                        if (!isSuccess || (writeOutput && writeOutput.includes('ERROR'))) {
                            console.error('Failed to write temp script file:', writeOutput);
                            if (Core.isDebugMode()) {
                                Core.logDebug(`Temporary file write failed: ${writeOutput}`, 'ERROR');
                                Core.showToast(`[DEBUG] Failed to write file: ${writeOutput}`, 'error');
                            }
                            reject(new Error('临时脚本文件写入失败: ' + writeOutput));
                            return;
                        }
                        
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Temporary file written successfully: ${tempFile}`, 'SAVE');
                        }
                        
                        // 移动临时文件到目标位置并设置执行权限
                        Core.execCommand(`mv "${tempFile}" "${scriptPath}" && chmod +x "${scriptPath}"`, (mvOutput, isSuccess, details) => {
                            if (!isSuccess || (mvOutput && mvOutput.includes('ERROR'))) {
                                console.error('Failed to move script file:', mvOutput);
                                if (Core.isDebugMode()) {
                                    Core.logDebug(`Script file move failed: ${mvOutput}`, 'ERROR');
                                    Core.showToast(`[DEBUG] Failed to move file: ${mvOutput}`, 'error');
                                }
                                reject(new Error('脚本文件移动失败: ' + mvOutput));
                            } else {
                                // 验证文件是否成功保存
                                Core.execCommand(`test -f "${scriptPath}" && echo "FILE_EXISTS" || echo "FILE_NOT_EXISTS"`, (testOutput, isSuccess, details) => {
                                    if (testOutput && testOutput.trim() === 'FILE_EXISTS') {
                                        console.log('Script saved successfully:', scriptPath);
                                        if (Core.isDebugMode()) {
                                            Core.logDebug(`Script saved and verified successfully: ${scriptPath}`, 'SAVE');
                                            Core.showToast(`[DEBUG] Script saved successfully: ${scenario.name}`, 'success');
                                        }
                                        resolve(scriptPath);
                                    } else {
                                        console.error('Script file verification failed:', scriptPath);
                                        if (Core.isDebugMode()) {
                                            Core.logDebug(`Script file verification failed: ${scriptPath}`, 'ERROR');
                                            Core.showToast(`[DEBUG] File verification failed: ${scriptPath}`, 'error');
                                        }
                                        reject(new Error('脚本文件验证失败'));
                                    }
                                });
                            }
                        });
                    });
                });
            } catch (error) {
                console.error('Failed to save script to file:', error);
                if (Core.isDebugMode()) {
                    Core.logDebug(`Script save error: ${error.message}`, 'ERROR');
                    Core.showToast(`[DEBUG] Save exception: ${error.message}`, 'error');
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
                    Core.logDebug(`Export failed: scenario not found (ID: ${scenarioId})`, 'EXPORT');
                    Core.showToast(`[DEBUG] Export failed: scenario not found`, 'error');
                }
                Core.showToast(Core.t('messages.common.notFound'), 'error');
                reject(new Error('情景不存在'));
                return;
            }

            if (Core.isDebugMode()) {
                Core.logDebug(`Start exporting scenario: ${scenario.name} (ID: ${scenarioId}) to ${exportPath}`, 'EXPORT');
                Core.showToast(`[DEBUG] Exporting scenario: ${scenario.name}`, 'info');
            }

            const sourceFile = `${this.scriptsPath}${scenarioId}.sh`;
            const targetFile = `${exportPath}/${scenario.name}_${scenarioId}.sh`;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`Source file: ${sourceFile}, target file: ${targetFile}`, 'EXPORT');
            }
            
            // 确保目标目录存在
            Core.execCommand(`mkdir -p "${exportPath}"`, (mkdirOutput, isSuccess, details) => {
                if (!isSuccess || (mkdirOutput && mkdirOutput.includes('ERROR'))) {
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Export directory creation failed: ${mkdirOutput}`, 'ERROR');
                        Core.showToast(`[DEBUG] Failed to create directory: ${mkdirOutput}`, 'error');
                    }
                    Core.showToast(Core.t('messages.common.failed', { error: 'Failed to create export directory' }), 'error');
                    reject(new Error('创建导出目录失败'));
                    return;
                }
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`Export directory created successfully: ${exportPath}`, 'EXPORT');
                }
                
                // 复制文件
                Core.execCommand(`cp "${sourceFile}" "${targetFile}"`, (cpOutput, isSuccess, details) => {
                    if (!isSuccess || (cpOutput && cpOutput.includes('ERROR'))) {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`File copy failed: ${cpOutput}`, 'ERROR');
                            Core.showToast(`[DEBUG] Failed to copy file: ${cpOutput}`, 'error');
                        }
                        Core.showToast(Core.t('messages.common.failed', { error: 'Failed to export file' }), 'error');
                        reject(new Error('导出文件失败'));
                    } else {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Scenario exported successfully: ${targetFile}`, 'EXPORT');
                            Core.showToast(`[DEBUG] Export successful: ${scenario.name}`, 'success');
                        }
                        Core.showToast(Core.t('messages.common.success'), 'success');
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
                Core.logDebug(`Start importing scenario: ${importPath}`, 'IMPORT');
                Core.showToast(`[DEBUG] Importing scenario: ${importPath}`, 'info');
            }
            
            Core.showToast(Core.t('messages.common.importing'), 'info');
            // 检查文件是否存在
            Core.execCommand(`test -f "${importPath}" && echo "exists"`, (testOutput, isSuccess, details) => {
                if (!isSuccess || !testOutput || !testOutput.includes('exists')) {
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Import file not found: ${importPath}`, 'ERROR');
                        Core.showToast(`[DEBUG] File not found: ${importPath}`, 'error');
                    }
                    Core.showToast(Core.t('errors.fileNotFound'), 'error');
                    reject(new Error('导入文件不存在'));
                    return;
                }
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`Import file exists, start processing: ${importPath}`, 'IMPORT');
                }
                
                // 生成新的情景ID
                const newId = Date.now().toString();
                const targetFile = `${this.scriptsPath}${newId}.sh`;
                
                if (Core.isDebugMode()) {
                    Core.logDebug(`Generated new ID: ${newId}, target file: ${targetFile}`, 'IMPORT');
                }
                
                // 确保脚本目录存在
                Core.execCommand(`mkdir -p "${this.scriptsPath}"`, (mkdirOutput, isSuccess, details) => {
                    if (!isSuccess || (mkdirOutput && mkdirOutput.includes('ERROR'))) {
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Script directory creation failed: ${mkdirOutput}`, 'ERROR');
                            Core.showToast(`[DEBUG] Failed to create directory: ${mkdirOutput}`, 'error');
                        }
                        Core.showToast(Core.t('messages.common.failed', { error: 'Failed to create script directory' }), 'error');
                        reject(new Error('创建脚本目录失败'));
                        return;
                    }
                    
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Script directory created successfully: ${this.scriptsPath}`, 'IMPORT');
                    }
                    
                    // 复制文件到脚本目录
                    Core.execCommand(`cp "${importPath}" "${targetFile}"`, (cpOutput, isSuccess, details) => {
                        if (!isSuccess || (cpOutput && cpOutput.includes('ERROR'))) {
                            if (Core.isDebugMode()) {
                                Core.logDebug(`File copy failed: ${cpOutput}`, 'ERROR');
                                Core.showToast(`[DEBUG] Failed to copy file: ${cpOutput}`, 'error');
                            }
                            Core.showToast(Core.t('messages.common.failed', { error: 'Failed to import file' }), 'error');
                            reject(new Error('导入文件失败'));
                        } else {
                            if (Core.isDebugMode()) {
                                Core.logDebug(`File copied successfully, start parsing script: ${targetFile}`, 'IMPORT');
                            }
                            
                            // 解析导入的脚本文件
                            this.parseScriptFile(targetFile, () => {
                                if (Core.isDebugMode()) {
                                    Core.logDebug(`Scenario imported successfully, new ID: ${newId}`, 'IMPORT');
                                    Core.showToast(`[DEBUG] Import successful, ID: ${newId}`, 'success');
                                }
                                Core.showToast(Core.t('messages.common.success'), 'success');
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
            
            Core.showToast(Core.t('messages.common.success'), 'success');
            return scenario;
        } catch (error) {
            Core.showToast(Core.t('messages.common.failed', { error: 'Failed to add scenario' }), 'error');
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
                
                Core.showToast(Core.t('messages.common.success'), 'success');
                return true;
            } catch (error) {
                // 如果保存失败，回滚操作
                this.scenarios[index] = originalScenario;
                Core.showToast(Core.t('messages.common.failed', { error: error.message }), 'error');
                throw error;
            }
        }
        Core.showToast(Core.t('messages.common.notFound'), 'error');
        throw new Error('情景不存在');
    }
    
    async deleteScenario(id) {
        const index = this.scenarios.findIndex(s => s.id === id);
        if (index >= 0) {
            const deletedScenario = this.scenarios[index];
            const scriptPath = `${this.scriptsPath}${id}.sh`;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`Start deleting scenario: ${deletedScenario.name} (ID: ${id})`, 'DELETE');
                Core.logDebug(`Script file path: ${scriptPath}`, 'DELETE');
                Core.showToast(`[DEBUG] Deleting scenario: ${deletedScenario.name}`, 'info');
            }
            
            return new Promise((resolve, reject) => {
                // 删除脚本文件
                Core.execCommand(`rm -f "${scriptPath}"`, (output, isSuccess, details) => {
                    if (!isSuccess || (output && output.includes('ERROR'))) {
                        console.error('Failed to delete script file:', output);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Script file deletion failed: ${output}`, 'ERROR');
                            Core.showToast(`[DEBUG] Failed to delete file: ${output}`, 'error');
                        }
                        Core.showToast(Core.t('messages.common.failed', { error: 'Failed to delete script file' }), 'error');
                        reject(new Error('脚本文件删除失败: ' + output));
                    } else {
                        // 从内存中移除情景
                        this.scenarios.splice(index, 1);
                        console.log('Script deleted successfully:', scriptPath);
                        if (Core.isDebugMode()) {
                            Core.logDebug(`Scenario deleted successfully: ${deletedScenario.name}`, 'DELETE');
                            Core.showToast(`[DEBUG] Delete successful: ${deletedScenario.name}`, 'success');
                        }
                        Core.showToast(Core.t('messages.common.success'), 'success');
                        resolve(true);
                    }
                });
            });
        }
        if (Core.isDebugMode()) {
            Core.logDebug(`Delete failed: scenario not found (ID: ${id})`, 'ERROR');
            Core.showToast(`[DEBUG] Scenario not found: ${id}`, 'error');
        }
        Core.showToast(Core.t('messages.common.notFound'), 'error');
        throw new Error('情景不存在');
    }
    
    generateScript(scenario) {
        if (Core.isDebugMode()) {
            Core.logDebug(`Start generating script: ${scenario.name}`, 'GENERATE');
            Core.showToast(`[DEBUG] Generating script: ${scenario.name}`, 'info');
        }
        
        let script = '#!/system/bin/sh\n\n';
        
        // 添加完整的元数据注释，确保可以被正确解析
        script += `# name: ${scenario.name}\n`;
        script += `# description: ${scenario.description || ''}\n`;
        script += `# author: ${scenario.author || ''}\n`;
        script += `# version: ${scenario.version || '1.0'}\n`;
        script += `# Generated scenario script: ${scenario.name}\n`;
        script += `source "${Core.MODULE_PATH}Core.sh"\n`;
        script += `Installer_Compatibility="${scenario.compatibilityMode ? 'true' : 'false'}"\n`;
        script += `Installer_Log="true"\n\n`;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Script header generated, compatibility mode: ${scenario.compatibilityMode}`, 'GENERATE');
        }
        
        // 进度报告函数
        script += 'report_progress() {\n';
        script += '    echo "PROGRESS:$1:$2:$3"\n';
        script += '}\n\n';
        
        script += `log_info "Starting scenario: ${scenario.name}"\n`;
        script += `report_progress "0" "${scenario.operations.length}" "开始执行情景"\n\n`;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Start generating script for ${scenario.operations.length} operations`, 'GENERATE');
        }
        
        // 生成操作脚本
        scenario.operations.forEach((operation, index) => {
            const operationNumber = index + 1;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`Generate operation ${operationNumber}: ${JSON.stringify(operation)}`, 'GENERATE');
            }
            
            script += `# Operation ${operationNumber}\n`;
            script += `log_info "[${operationNumber}/${scenario.operations.length}] ${this.getOperationDescription(operation)}"\n`;
            script += `report_progress "${index}" "${scenario.operations.length}" "${this.getOperationDescription(operation)}"\n`;
            
            // 生成具体操作脚本
            const operationScript = this.generateOperationScript(operation, operationNumber);
            script += operationScript;
            
            if (Core.isDebugMode()) {
                Core.logDebug(`Operation ${operationNumber} script generated: ${operationScript.trim()}`, 'GENERATE');
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
                Core.logDebug('Add auto reboot script', 'GENERATE');
            }
        }
        
        script += '\nexit 0\n';
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Script generation completed, total length: ${script.length} characters`, 'GENERATE');
            Core.showToast(`[DEBUG] Script generation completed: ${scenario.operations.length} operations`, 'success');
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
        
        return `flash_boot "${operation.path}" || exit 1\n`;
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
                Core.logDebug(`Execution failed: scenario not found (ID: ${scenarioId})`, 'ERROR');
                Core.showToast(`[DEBUG] Scenario not found: ${scenarioId}`, 'error');
            }
            Core.showToast(Core.t('messages.common.notFound'), 'error');
            throw new Error('Scenario not found');
        }
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Start executing scenario: ${scenario.name} (ID: ${scenarioId})`, 'EXECUTE');
            Core.logDebug(`Scenario contains ${scenario.operations.length} operations`, 'EXECUTE');
            Core.showToast(`[DEBUG] Executing scenario: ${scenario.name}`, 'info');
        }
        
        Core.showToast(Core.t('messages.common.executing'), 'info');
        const scriptPath = `${this.scriptsPath}${scenarioId}.sh`;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Script path: ${scriptPath}`, 'EXECUTE');
        }
        
        return new Promise((resolve, reject) => {
            Core.execCommand(`sh "${scriptPath}"`, (output, isSuccess, details) => {
                // 使用新的错误检测机制，优先使用ksu返回的errno
                const hasError = !isSuccess || (output && output.includes('ERROR'));
                
                if (hasError) {
                    console.error('Failed to execute scenario script:', output);
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Scenario execution failed: ${output}`, 'ERROR');
                        if (details) {
                            Core.logDebug(`Execution details - errno: ${details.errno}, stderr: ${details.stderr}`, 'ERROR');
                        }
                        Core.showToast(`[DEBUG] Execution failed: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`, 'error');
                    }
                    Core.showToast(Core.t('messages.common.failed', { error: output }), 'error');
                    reject(new Error('脚本执行失败: ' + output));
                } else {
                    console.log('Scenario executed successfully:', output);
                    if (Core.isDebugMode()) {
                        Core.logDebug(`Scenario executed successfully: ${scenario.name}`, 'EXECUTE');
                        Core.logDebug(`Execution output length: ${output ? output.length : 0} characters`, 'EXECUTE');
                        if (details) {
                            Core.logDebug(`Execution details - errno: ${details.errno}, stdout length: ${details.stdout ? details.stdout.length : 0}`, 'EXECUTE');
                        }
                        if (output && output.length > 0) {
                            Core.logDebug(`Execution output content: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}`, 'EXECUTE');
                        }
                        Core.showToast(`[DEBUG] Execution successful: ${scenario.name}`, 'success');
                    }
                    Core.showToast(Core.t('messages.common.success'), 'success');
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
            
            Core.execCommand(`cp "${scriptPath}" "${newScriptPath}" && chmod +x "${newScriptPath}"`, (output, isSuccess, details) => {
                if (!isSuccess || (output && output.includes('ERROR'))) {
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
            throw new Error('Scenario not found');
        }
        
        // 验证操作数据
        if (!this.validateOperation(operation)) {
            throw new Error('Invalid operation data');
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
            throw new Error('Invalid operation index');
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
            throw new Error('Invalid operation data');
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