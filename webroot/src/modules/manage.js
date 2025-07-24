import { Core } from '../core.js';

export class ManagePage {
    constructor(scenarioManager, settingsManager) {
        this.scenarioManager = scenarioManager;
        this.settingsManager = settingsManager;
        this.container = document.getElementById('manage-list');
        this.editDialog = document.getElementById('edit-dialog');
        this.operationDialog = document.getElementById('operation-dialog');
        this.operationEditDialog = document.getElementById('operation-edit-dialog');
        this.importDialog = document.getElementById('import-dialog');
        this.exportDialog = document.getElementById('export-dialog');
        
        this.currentScenario = null;
        this.currentOperationIndex = -1;
        this.boundHandleClick = this.handleClick.bind(this);
        
        this.setupDialogs();
    }
    
    showDialogWithAnimation(dialog) {
        if (Core.isDebugMode()) {
            Core.logDebug(`Show dialog: ${dialog.id}`, 'MANAGE');
        }
        
        dialog.showModal();
        // 触发进入动画
        setTimeout(() => {
            dialog.classList.add('showing');
            if (Core.isDebugMode()) {
                Core.logDebug(`Dialog show animation completed: ${dialog.id}`, 'MANAGE');
            }
        }, 10);
    }
    
    closeDialogWithAnimation(dialog) {
        if (Core.isDebugMode()) {
            Core.logDebug(`Close dialog: ${dialog.id}`, 'MANAGE');
        }
        
        dialog.classList.remove('showing');
        dialog.classList.add('closing');
        
        // 等待动画完成后关闭对话框
        setTimeout(() => {
            dialog.close();
            dialog.classList.remove('closing');
            if (Core.isDebugMode()) {
                Core.logDebug(`Dialog close animation completed: ${dialog.id}`, 'MANAGE');
            }
        }, 200); // 与CSS动画时间一致
    }
    
    setupDialogs() {
        // 编辑对话框事件
        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.closeDialogWithAnimation(this.editDialog);
        });
        
        // 将提交事件绑定到保存按钮上，而不是依赖表单提交
        document.querySelector('#edit-dialog fieldset button.filled').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveScenario();
        });
        
        // 操作类型选择对话框事件
        document.getElementById('cancel-operation').addEventListener('click', () => {
            this.closeDialogWithAnimation(this.operationDialog);
        });
        
        this.operationDialog.querySelectorAll('.operation-type-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const type = e.target.closest('[data-type]').dataset.type;
                this.closeDialogWithAnimation(this.operationDialog);
                this.showOperationEditDialog(type);
            });
        });
        
        // 操作编辑对话框事件
        document.getElementById('cancel-operation-edit').addEventListener('click', () => {
            this.closeDialogWithAnimation(this.operationEditDialog);
        });
        
        // 将提交事件绑定到操作编辑对话框的确定按钮上
        document.querySelector('#operation-edit-dialog fieldset button.filled').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveOperation();
        });
        
        // 添加操作按钮事件
        document.getElementById('add-operation').addEventListener('click', () => {
            this.currentOperationIndex = -1;
            this.showDialogWithAnimation(this.operationDialog);
        });
        
        // 导入对话框事件
        document.getElementById('cancel-import').addEventListener('click', () => {
            this.closeDialogWithAnimation(this.importDialog);
        });
        
        // 将提交事件绑定到导入对话框的导入按钮上
        document.querySelector('#import-dialog fieldset button.filled').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleImport();
        });
        
        // 导出对话框事件
        document.getElementById('cancel-export').addEventListener('click', () => {
            this.closeDialogWithAnimation(this.exportDialog);
        });
        
        // 将提交事件绑定到导出对话框的导出按钮上
        document.querySelector('#export-dialog fieldset button.filled').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleExportAll();
        });
    }
    
    refresh() {
        if (Core.isDebugMode()) {
            Core.logDebug('Refresh manage page content', 'MANAGE');
        }
        this.render();
    }
    
    render() {
        const scenarios = this.scenarioManager.getScenarios();
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Start rendering manage page, scenario count: ${scenarios.length}`, 'MANAGE');
        }
        
        if (scenarios.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--on-surface-variant);">
                    <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 1rem;">add_circle</span>
                    <h3>${Core.t('manage.empty.title')}</h3>
                    <p>${Core.t('manage.empty.description')}</p>
                </div>
            `;
            if (Core.isDebugMode()) {
                Core.logDebug('Show manage page empty state', 'MANAGE');
            }
            return;
        }
        
        this.container.innerHTML = scenarios.map(scenario => this.createManageCard(scenario)).join('');
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Manage page cards rendered, total ${scenarios.length} scenarios`, 'MANAGE');
        }
        
        // 绑定事件
        this.bindEvents();
    }
    
    createManageCard(scenario) {
        return `
            <div class="scenario-card" data-id="${scenario.id}">
                <h3>${this.escapeHtml(scenario.name)}</h3>
                <p>${scenario.operations.length} ${Core.t('home.scenario.operations')} • ${scenario.compatibilityMode ? Core.t('manage.scenario.compatibilityMode') : Core.t('manage.scenario.standardMode')} • ${scenario.autoReboot ? Core.t('manage.scenario.autoReboot') : Core.t('manage.scenario.manualReboot')}</p>

                <div class="scenario-operations">
                    ${scenario.operations.map((op, index) => `
                        <div class="operation-item" data-index="${index}">
                            <div class="operation-type">${this.getOperationTypeName(op.type)}</div>
                            <div class="operation-content">${this.getOperationContent(op)}</div>
                        </div>
                    `).join('')}
                </div>
                <fieldset>
                    <button type="button" class="delete-scenario" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                    <button type="button" class="export-scenario" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">file_download</span>
                    </button>
                    <button type="button" class="execute-scenario tonal" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">play_arrow</span>
                    </button>
                    <button type="button" class="edit-scenario filled" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                </fieldset>
            </div>
        `;
    }
    
    getOperationTypeName(type) {
        const names = {
            install_module: `${Core.t('manage.operation.types.install_module')}`,
            delete_module: `${Core.t('manage.operation.types.delete_module')}`,
            flash_boot: `${Core.t('manage.operation.types.flash_boot')}`,
            custom_script: `${Core.t('manage.operation.types.custom_script')}`
        };
        return names[type] || type;
    }
    
    getOperationContent(operation) {
        switch (operation.type) {
            case 'install_module':
                return operation.path || 'Path not set';
            case 'delete_module':
                return operation.path || 'Path not set';
            case 'flash_boot':
                return `${operation.path || 'Path not set'} ${operation.anykernel ? '(AnyKernel3)' : ''}`;
            case 'custom_script':
                return operation.script ? operation.script.substring(0, 50) + (operation.script.length > 50 ? '...' : '') : 'Script not set';
            default:
                return 'Unknown operation';
        }
    }
    
    bindEvents() {
        if (Core.isDebugMode()) {
            Core.logDebug('Start binding manage page event listeners', 'MANAGE');
        }
        
        // 移除旧的事件监听器
        this.container.removeEventListener('click', this.boundHandleClick);
        
        // 使用事件委托来处理动态生成的按钮
        this.container.addEventListener('click', this.boundHandleClick);
        
        if (Core.isDebugMode()) {
            Core.logDebug('Manage page event listeners bound', 'MANAGE');
        }
    }
    
    handleClick(e) {
        const target = e.target.closest('button');
        if (!target) return;
        
        const scenarioCard = target.closest('.scenario-card');
        if (!scenarioCard) return;
        
        const scenarioId = scenarioCard.dataset.id;
        
        if (target.classList.contains('edit-scenario')) {
            if (Core.isDebugMode()) {
                Core.logDebug(`User clicked edit scenario: ${scenarioId}`, 'MANAGE');
            }
            this.showEditDialog(scenarioId);
        } else if (target.classList.contains('delete-scenario')) {
            if (Core.isDebugMode()) {
                Core.logDebug(`User clicked delete scenario: ${scenarioId}`, 'MANAGE');
            }
            this.deleteScenario(scenarioId);
        } else if (target.classList.contains('execute-scenario')) {
            if (Core.isDebugMode()) {
                Core.logDebug(`User clicked execute scenario: ${scenarioId}`, 'MANAGE');
            }
            this.executeScenario(scenarioId);
        } else if (target.classList.contains('export-scenario')) {
            if (Core.isDebugMode()) {
                Core.logDebug(`User clicked export scenario: ${scenarioId}`, 'MANAGE');
            }
            this.exportScenario(scenarioId);
        } else if (target.classList.contains('edit-operation')) {
            const operationIndex = parseInt(target.dataset.index);
            if (Core.isDebugMode()) {
                Core.logDebug(`User clicked edit operation: scenario ${scenarioId}, operation ${operationIndex}`, 'MANAGE');
            }
            this.editOperation(scenarioId, operationIndex);
        } else if (target.classList.contains('delete-operation')) {
            const operationIndex = parseInt(target.dataset.index);
            if (Core.isDebugMode()) {
                Core.logDebug(`User clicked delete operation: scenario ${scenarioId}, operation ${operationIndex}`, 'MANAGE');
            }
            this.deleteOperation(scenarioId, operationIndex);
        }
    }
    
    showEditDialog(scenarioId = null) {
        if (Core.isDebugMode()) {
            Core.logDebug(`Show edit dialog: ${scenarioId ? 'Edit scenario ' + scenarioId : 'New scenario'}`, 'MANAGE');
        }
        
        this.currentScenario = scenarioId ? this.scenarioManager.getScenario(scenarioId) : null;
        this.currentOperationIndex = -1; // 重置操作索引
        
        // 设置对话框标题
        document.getElementById('dialog-title').textContent = scenarioId ? Core.t('manage.editScenario') : Core.t('manage.newScenario');
        
        // 填充表单
        if (this.currentScenario) {
            document.getElementById('scenario-name').value = this.currentScenario.name;
            document.getElementById('compatibility-mode').checked = this.currentScenario.compatibilityMode;
            document.getElementById('auto-reboot').checked = this.currentScenario.autoReboot;
            // 为编辑情景创建操作列表的副本，避免直接修改原始数据
            this.currentScenario.operations = [...this.currentScenario.operations];
            this.renderOperationsList(this.currentScenario.operations);
            
            if (Core.isDebugMode()) {
                Core.logDebug(`Edit scenario form filled: ${this.currentScenario.name}, operations: ${this.currentScenario.operations.length}`, 'MANAGE');
            }
        } else {
            document.getElementById('scenario-form').reset();
            this.tempOperations = []; // 重置临时操作列表
            this.renderOperationsList([]);
            
            if (Core.isDebugMode()) {
                Core.logDebug('New scenario form reset completed', 'MANAGE');
            }
        }
        
        this.showDialogWithAnimation(this.editDialog);
    }
    
    renderOperationsList(operations) {
        const container = document.getElementById('operations-list');
        
        if (operations.length === 0) {
            container.innerHTML = `<p style="color: var(--on-surface-variant); text-align: center; padding: 1rem;">${Core.t('manage.operation.none')}</p>`;
            return;
        }
        
        container.innerHTML = operations.map((op, index) => `
            <div class="operation-item" data-index="${index}">
                <div class="operation-type">${this.getOperationTypeName(op.type)}</div>
                <div class="operation-content">${this.getOperationContent(op)}</div>
                <div class="operation-actions">
                    <button type="button" class="edit-dialog-operation" data-index="${index}" title="${Core.t('app.actions.edit')}">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button type="button" class="delete-dialog-operation" data-index="${index}" title="${Core.t('app.actions.delete')}">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
        
        // 使用事件委托来避免重复绑定
        // 移除旧的事件监听器
        container.removeEventListener('click', this.boundOperationClick);
        
        // 绑定新的事件监听器
        if (!this.boundOperationClick) {
            this.boundOperationClick = (e) => {
                const editBtn = e.target.closest('.edit-dialog-operation');
                const deleteBtn = e.target.closest('.delete-dialog-operation');
                
                if (editBtn) {
                    const index = parseInt(editBtn.dataset.index);
                    this.currentOperationIndex = index;
                    const currentOperations = this.currentScenario ? this.currentScenario.operations : this.tempOperations;
                    const operation = currentOperations[index];
                    this.showOperationEditDialog(operation.type, operation);
                } else if (deleteBtn) {
                    const index = parseInt(deleteBtn.dataset.index);
                    const currentOperations = this.currentScenario ? this.currentScenario.operations : this.tempOperations;
                    currentOperations.splice(index, 1);
                    
                    // 更新相应的操作列表
                    if (this.currentScenario) {
                        this.currentScenario.operations = currentOperations;
                    } else {
                        this.tempOperations = currentOperations;
                    }
                    
                    this.renderOperationsList(currentOperations);
                }
            };
        }
        
        container.addEventListener('click', this.boundOperationClick);
    }
    
    showOperationEditDialog(type, operation = null) {
        if (Core.isDebugMode()) {
            Core.logDebug(`Show operation edit dialog: ${type}, edit mode: ${operation ? 'yes' : 'no'}`, 'MANAGE');
        }
        
        const titles = {
            install_module: Core.t('manage.operation.types.install_module'),
            delete_module: Core.t('manage.operation.types.delete_module'),
            flash_boot: Core.t('manage.operation.types.flash_boot'),
            custom_script: Core.t('manage.operation.types.custom_script')
        };
        
        document.getElementById('operation-edit-title').textContent = titles[type] || Core.t('manage.editOperation');
        
        const fieldsContainer = document.getElementById('operation-fields');
        fieldsContainer.innerHTML = this.getOperationFields(type, operation);
        
        // 绑定文件选择事件
        this.setupFileInputs();
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Operation edit dialog fields set: ${type}`, 'MANAGE');
        }
        
        this.showDialogWithAnimation(this.operationEditDialog);
    }
    
    getOperationFields(type, operation = null) {
        switch (type) {
            case 'install_module':
                return `
                    <input type="hidden" name="type" value="install_module">
                    <label>
                        <span>${Core.t('manage.operation.fields.modulePath')}</span>
                        <input type="text" name="path" value="${operation?.path || ''}" required placeholder="${Core.t('manage.operation.fields.modulePathPlaceholder')}">
                    </label>
                `;
            case 'delete_module':
                return `
                    <input type="hidden" name="type" value="delete_module">
                    <label>
                        <span>${Core.t('manage.operation.fields.modulePath')}</span>
                        <input type="text" name="path" value="${operation?.path || ''}" required placeholder="${Core.t('manage.operation.fields.modulePathPlaceholder')}">
                    </label>
                `;
            case 'flash_boot':
                return `
                    <input type="hidden" name="type" value="flash_boot">
                    <label>
                        <span>${Core.t('manage.operation.fields.imagePath')}</span>
                        <input type="text" name="path" value="${operation?.path || ''}" required placeholder="${Core.t('manage.operation.fields.imagePathPlaceholder')}">
                    </label>
                    <p>${Core.t('manage.operation.fields.anykernelDesc')}</p>
                `;
            case 'custom_script':
                return `
                    <input type="hidden" name="type" value="custom_script">
                    <label>
                        <span>${Core.t('manage.operation.fields.scriptContent')}</span>
                        <textarea name="script" rows="6" required>${operation?.script || ''}</textarea>
                    </label>
                `;
            default:
                return `<p>${Core.t('errors.unknownError')}</p>`;
        }
    }
    
    async handleImport() {
        const importPath = document.getElementById('import-path').value.trim();
        if (!importPath) {
            Core.showToast(Core.t('manage.import.pathRequired'), 'error');
            return;
        }
        
        try {
            const newId = await this.scenarioManager.importScenario(importPath);
            Core.showToast(Core.t('manage.import.success'), 'success');
            this.closeDialogWithAnimation(this.importDialog);
            this.refresh();
            document.getElementById('import-path').value = '';
        } catch (error) {
            Core.showToast(`${Core.t('manage.import.failed')}: ${error.message}`, 'error');
        }
    }
    
    async handleExportAll() {
        const exportPath = document.getElementById('export-path').value.trim();
        if (!exportPath) {
            Core.showToast(Core.t('manage.export.pathRequired'), 'error');
            return;
        }
        
        try {
            const results = await this.scenarioManager.exportAllScenarios(exportPath);
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            
            if (successCount === totalCount) {
                Core.showToast(Core.t('manage.export.success', { count: successCount }), 'success');
            } else {
                Core.showToast(`${Core.t('manage.export.partial')}: ${successCount}/${totalCount}`, 'warning');
            }
            
            this.closeDialogWithAnimation(this.exportDialog);
            // 更新设置中的导出路径
            this.settingsManager.setSetting('exportPath', exportPath);
        } catch (error) {
            Core.showToast(`${Core.t('manage.export.failed')}: ${error.message}`, 'error');
        }
    }
    
    setupFileInputs() {
        // 文件选择功能已移除，用户需要手动输入路径
        // 这个方法保留为空，以防其他地方调用
    }
    
    saveOperation() {
        if (Core.isDebugMode()) {
            Core.showToast('[DEBUG] Starting to save operation', 'info');
            Core.logDebug('MANAGE', 'Start saving operation');
        }
        
        const form = document.getElementById('operation-form');
        const formData = new FormData(form);
        
        // 验证必填字段
        const requiredFields = form.querySelectorAll('[required]');
        for (const field of requiredFields) {
            if (!field.value.trim()) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Validation failed: ${field.name} is empty`);
                }
                Core.showToast(Core.t('messages.validation.fieldsRequired'), 'warning');
                field.focus();
                return;
            }
        }
        
        const operation = {
            type: formData.get('type')
        };
        
        if (Core.isDebugMode()) {
            Core.logDebug('MANAGE', `Operation type: ${operation.type}`);
        }
        
        // 根据类型添加特定字段
        switch (operation.type) {
            case 'install_module':
                operation.path = formData.get('path');
                if (!operation.path) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', 'Install module operation: path is empty');
                    }
                    Core.showToast(Core.t('messages.errors.fieldsRequired'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Install module operation: ${operation.path}`);
                }
                break;
            case 'delete_module':
                operation.path = formData.get('path');
                if (!operation.path) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', 'Remove module operation: path is empty');
                    }
                    Core.showToast(Core.t('messages.validation.selectFile'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Remove module operation: ${operation.path}`);
                }
                break;
            case 'flash_boot':
                operation.path = formData.get('path');
                operation.anykernel = true; // 自动设置为true，因为现在脚本会自动判断
                if (!operation.path) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', 'Flash boot operation: path is empty');
                    }
                    Core.showToast(Core.t('messages.validation.selectFile'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Flash boot operation: ${operation.path}, AnyKernel: ${operation.anykernel}`);
                }
                break;
            case 'custom_script':
                operation.script = formData.get('script');
                if (!operation.script) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', 'Custom script operation: script content is empty');
                    }
                    Core.showToast(Core.t('messages.errors.fieldsRequired'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Custom script operation: ${operation.script.length} characters`);
                }
                break;
        }
        
        // 获取当前操作列表
        let operations;
        if (this.currentScenario) {
            operations = [...this.currentScenario.operations];
        } else {
            // 对于新情景，从临时存储中获取操作列表
            if (!this.tempOperations) {
                this.tempOperations = [];
            }
            operations = [...this.tempOperations];
        }
        
        if (this.currentOperationIndex >= 0) {
            // 编辑现有操作
            operations[this.currentOperationIndex] = operation;
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `Edit operation index: ${this.currentOperationIndex}`);
            }
        } else {
            // 添加新操作
            operations.push(operation);
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `Add new operation, total: ${operations.length}`);
            }
        }
        
        // 更新操作列表显示
        this.renderOperationsList(operations);
        
        // 保存到相应的位置
        if (this.currentScenario) {
            this.currentScenario.operations = operations;
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', 'Save to existing scenario');
            }
        } else {
            this.tempOperations = operations;
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', 'Save to temporary operation list');
            }
        }
        
        this.closeDialogWithAnimation(this.operationEditDialog);
        if (Core.isDebugMode()) {
            Core.showToast('[DEBUG] Operation saved successfully', 'success');
        }
        Core.showToast(Core.t('messages.common.saved'), 'success');
    }
    
    async saveScenario() {
        if (Core.isDebugMode()) {
            Core.showToast('[DEBUG] Starting to save scenario', 'info');
            Core.logDebug('MANAGE', 'Start saving scenario operation');
        }
        
        const form = document.getElementById('scenario-form');
        const formData = new FormData(form);
        
        const name = formData.get('scenario-name');
        if (!name || !name.trim()) {
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', 'Save failed: scenario name is empty');
            }
            Core.showToast(Core.t('messages.validation.enterName'), 'warning');
            return;
        }
        
        const operations = this.currentScenario ? this.currentScenario.operations : (this.tempOperations || []);
        
        const scenario = {
            id: this.currentScenario ? this.currentScenario.id : Date.now().toString(),
            name: name.trim(),
            compatibilityMode: formData.has('compatibility-mode'),
            autoReboot: formData.has('auto-reboot'),
            operations: operations
        };
        
        if (Core.isDebugMode()) {
            Core.logDebug('MANAGE', `Scenario data: ID=${scenario.id}, name=${scenario.name}, compatibility=${scenario.compatibilityMode}, autoReboot=${scenario.autoReboot}, operations=${scenario.operations.length}`);
            Core.showToast(`[DEBUG] Scenario have ${scenario.operations.length} operations`, 'info');
        }
        
        // 显示保存中的提示
        const saveButton = document.querySelector('#edit-dialog fieldset button.filled');
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = Core.t('app.actions.saving');
        
        try {
            if (this.currentScenario) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', 'Update existing scenario: ' + scenario.id);
                }
                await this.scenarioManager.updateScenario(scenario);
            } else {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', 'Add new scenario: ' + scenario.id);
                }
                await this.scenarioManager.addScenario(scenario);
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', 'Scenario saved successfully, close dialog and refresh list');
                Core.showToast('[DEBUG] Scenario saved successfully', 'success');
            }
            
            this.closeDialogWithAnimation(this.editDialog);
            this.refresh();
            
        } catch (error) {
            console.error('Save scenario error:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `Save scenario failed: ${error.message || 'Unknown error'}`);
                Core.showToast(Core.t('messages.common.failed', { error: error.message || 'Unknown error' }), 'error');
            }
            Core.showToast(Core.t('messages.common.failed', { error: error.message || 'Unknown error' }), 'error');
        } finally {
            // 恢复按钮状态
            saveButton.disabled = false;
            saveButton.textContent = originalText;
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', 'Restore save button state');
            }
        }
    }
    
    async exportScenario(scenarioId) {
        try {
            const exportPath = this.settingsManager.getSetting('exportPath');
            const result = await this.scenarioManager.exportScenario(scenarioId, exportPath);
            Core.showToast(Core.t('messages.common.success'), 'success');
        } catch (error) {
            Core.showToast(Core.t('messages.common.failed', { error: error.message }), 'error');
        }
    }
    
    async deleteScenario(scenarioId) {
        const confirmed = await window.DialogManager.showConfirm(
            Core.t('app.actions.delete'),
            Core.t('messages.common.deleteConfirm')
        );
        
        if (confirmed) {
            try {
                await this.scenarioManager.deleteScenario(scenarioId);
                Core.showToast(Core.t('messages.common.success'), 'success');
                this.refresh();
            } catch (error) {
                console.error('Delete scenario error:', error);
                Core.showToast(Core.t('messages.common.failed', { error: error.message || 'Unknown error' }), 'error');
            }
        }
    }
    
    async executeScenario(scenarioId) {
        if (Core.isDebugMode()) {
            Core.showToast('[DEBUG] Starting to execute scenario', 'info');
            Core.logDebug('MANAGE', `Start executing scenario: ${scenarioId}`);
        }
        
        try {
            const scenario = this.scenarioManager.getScenario(scenarioId);
            if (!scenario) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Scenario not found: ${scenarioId}`);
                }
                Core.showToast(Core.t('messages.errors.fileNotFound'), 'error');
            return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `Found scenario: ${scenario.name}, operations: ${scenario.operations.length}`);
            }
            
            if (scenario.operations.length === 0) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', 'Scenario has no operations');
                }
                Core.showToast(Core.t('messages.common.noOperations'), 'warning');
            return;
            }
            
            // 显示确认对话框
            const confirmed = await window.DialogManager.showConfirm(
                '执行情景',
                `确定要执行情景 "${scenario.name}" 吗？\n\n此操作将执行以下内容：\n${scenario.operations.map(op => `• ${this.getOperationTypeName(op.type)}: ${this.getOperationContent(op)}`).join('\n')}${scenario.autoReboot ? '\n\n⚠️ 执行完成后设备将自动重启' : ''}`
            );
            
            if (!confirmed) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', 'User cancelled scenario execution');
                }
                return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', 'User confirmed scenario execution, start executing script');
            }
            
            Core.showToast(Core.t('messages.common.executing'), 'info');
            
            try {
                const output = await this.scenarioManager.executeScenario(scenarioId);
                console.log('Script execution output:', output);
                
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Script execution completed, output length: ${output ? output.length : 0}`);
                    if (output && output.trim()) {
                        Core.logDebug('MANAGE', `Script output: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`);
                    }
                    Core.showToast('[DEBUG] Script executed successfully', 'success');
                }
                
                Core.showToast(Core.t('messages.common.success'), 'success');
                
                // 显示执行结果
                if (output && output.trim()) {
                    console.log('Scenario execution completed:', output);
                }
                
            } catch (executeError) {
                console.error('Script execution failed:', executeError);
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `Script execution failed: ${executeError.message}`);
                    Core.showToast(`[DEBUG] Script execution failed: ${executeError.message}`, 'error');
                }
                Core.showToast(Core.t('messages.common.failed', { error: executeError.message }), 'error');
            }
            
        } catch (error) {
            console.error('Execute scenario error:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `Error occurred while executing scenario: ${error.message}`);
                Core.showToast(`[DEBUG] Execution error: ${error.message}`, 'error');
            }
            Core.showToast(Core.t('messages.common.failed', { error: error.message }), 'error');
        }
    }
    
    editOperation(scenarioId, operationIndex) {
        const scenario = this.scenarioManager.getScenario(scenarioId);
        if (scenario && scenario.operations[operationIndex]) {
            this.currentScenario = scenario;
            this.currentOperationIndex = operationIndex;
            const operation = scenario.operations[operationIndex];
            this.showOperationEditDialog(operation.type, operation);
        }
    }
    
    async deleteOperation(scenarioId, operationIndex) {
        const confirmed = await window.DialogManager.showConfirm(
            Core.t('app.actions.delete'),
            Core.t('messages.common.confirmDelete')
        );
        
        if (confirmed) {
            try {
                const scenario = this.scenarioManager.getScenario(scenarioId);
                if (scenario) {
                    scenario.operations.splice(operationIndex, 1);
                    await this.scenarioManager.updateScenario(scenario);
                    Core.showToast(Core.t('messages.common.deleted'), 'success');
                    this.refresh();
                }
            } catch (error) {
                console.error('Delete operation error:', error);
                Core.showToast(Core.t('messages.common.failed', { error: error.message || '未知错误' }), 'error');
            }
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}