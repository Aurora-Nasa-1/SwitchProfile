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
            Core.logDebug(`显示对话框: ${dialog.id}`, 'MANAGE');
        }
        
        dialog.showModal();
        // 触发进入动画
        setTimeout(() => {
            dialog.classList.add('showing');
            if (Core.isDebugMode()) {
                Core.logDebug(`对话框显示动画完成: ${dialog.id}`, 'MANAGE');
            }
        }, 10);
    }
    
    closeDialogWithAnimation(dialog) {
        if (Core.isDebugMode()) {
            Core.logDebug(`关闭对话框: ${dialog.id}`, 'MANAGE');
        }
        
        dialog.classList.remove('showing');
        dialog.classList.add('closing');
        
        // 等待动画完成后关闭对话框
        setTimeout(() => {
            dialog.close();
            dialog.classList.remove('closing');
            if (Core.isDebugMode()) {
                Core.logDebug(`对话框关闭动画完成: ${dialog.id}`, 'MANAGE');
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
        
        // 导入情景按钮
        document.getElementById('import-scenario-btn').addEventListener('click', () => {
            this.showDialogWithAnimation(this.importDialog);
        });
        
        // 导出全部按钮
        document.getElementById('export-all-btn').addEventListener('click', () => {
            const exportPath = this.settingsManager.getSetting('exportPath');
            document.getElementById('export-path').value = exportPath;
            this.showDialogWithAnimation(this.exportDialog);
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
            Core.logDebug('刷新管理页面内容', 'MANAGE');
        }
        this.render();
    }
    
    render() {
        const scenarios = this.scenarioManager.getScenarios();
        
        if (Core.isDebugMode()) {
            Core.logDebug(`开始渲染管理页面，情景数量: ${scenarios.length}`, 'MANAGE');
        }
        
        if (scenarios.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--on-surface-variant);">
                    <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 1rem;">add_circle</span>
                    <h3>开始创建情景</h3>
                    <p>点击右下角的 + 按钮创建第一个情景</p>
                </div>
            `;
            if (Core.isDebugMode()) {
                Core.logDebug('显示管理页面空状态', 'MANAGE');
            }
            return;
        }
        
        this.container.innerHTML = scenarios.map(scenario => this.createManageCard(scenario)).join('');
        
        if (Core.isDebugMode()) {
            Core.logDebug(`管理页面卡片渲染完成，共 ${scenarios.length} 个情景`, 'MANAGE');
        }
        
        // 绑定事件
        this.bindEvents();
    }
    
    createManageCard(scenario) {
        return `
            <div class="scenario-card" data-id="${scenario.id}">
                <h3>${this.escapeHtml(scenario.name)}</h3>
                <p>${scenario.operations.length} 个操作 • ${scenario.compatibilityMode ? '兼容模式' : '标准模式'} • ${scenario.autoReboot ? '自动重启' : '手动重启'}</p>
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
            install_module: '安装模块',
            delete_module: '删除模块',
            flash_boot: '刷入Boot',
            custom_script: '自定义脚本'
        };
        return names[type] || type;
    }
    
    getOperationContent(operation) {
        switch (operation.type) {
            case 'install_module':
                return operation.path || '未设置路径';
            case 'delete_module':
                return operation.path || '未设置路径';
            case 'flash_boot':
                return `${operation.path || '未设置路径'} ${operation.anykernel ? '(AnyKernel3)' : ''}`;
            case 'custom_script':
                return operation.script ? operation.script.substring(0, 50) + (operation.script.length > 50 ? '...' : '') : '未设置脚本';
            default:
                return '未知操作';
        }
    }
    
    bindEvents() {
        if (Core.isDebugMode()) {
            Core.logDebug('开始绑定管理页面事件监听器', 'MANAGE');
        }
        
        // 移除旧的事件监听器
        this.container.removeEventListener('click', this.boundHandleClick);
        
        // 使用事件委托来处理动态生成的按钮
        this.container.addEventListener('click', this.boundHandleClick);
        
        if (Core.isDebugMode()) {
            Core.logDebug('管理页面事件监听器绑定完成', 'MANAGE');
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
                Core.logDebug(`用户点击编辑情景: ${scenarioId}`, 'MANAGE');
            }
            this.showEditDialog(scenarioId);
        } else if (target.classList.contains('delete-scenario')) {
            if (Core.isDebugMode()) {
                Core.logDebug(`用户点击删除情景: ${scenarioId}`, 'MANAGE');
            }
            this.deleteScenario(scenarioId);
        } else if (target.classList.contains('execute-scenario')) {
            if (Core.isDebugMode()) {
                Core.logDebug(`用户点击执行情景: ${scenarioId}`, 'MANAGE');
            }
            this.executeScenario(scenarioId);
        } else if (target.classList.contains('export-scenario')) {
            if (Core.isDebugMode()) {
                Core.logDebug(`用户点击导出情景: ${scenarioId}`, 'MANAGE');
            }
            this.exportScenario(scenarioId);
        } else if (target.classList.contains('edit-operation')) {
            const operationIndex = parseInt(target.dataset.index);
            if (Core.isDebugMode()) {
                Core.logDebug(`用户点击编辑操作: 情景${scenarioId}, 操作${operationIndex}`, 'MANAGE');
            }
            this.editOperation(scenarioId, operationIndex);
        } else if (target.classList.contains('delete-operation')) {
            const operationIndex = parseInt(target.dataset.index);
            if (Core.isDebugMode()) {
                Core.logDebug(`用户点击删除操作: 情景${scenarioId}, 操作${operationIndex}`, 'MANAGE');
            }
            this.deleteOperation(scenarioId, operationIndex);
        }
    }
    
    showEditDialog(scenarioId = null) {
        if (Core.isDebugMode()) {
            Core.logDebug(`显示编辑对话框: ${scenarioId ? '编辑情景 ' + scenarioId : '新建情景'}`, 'MANAGE');
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
                Core.logDebug(`编辑情景表单填充完成: ${this.currentScenario.name}, 操作数: ${this.currentScenario.operations.length}`, 'MANAGE');
            }
        } else {
            document.getElementById('scenario-form').reset();
            this.tempOperations = []; // 重置临时操作列表
            this.renderOperationsList([]);
            
            if (Core.isDebugMode()) {
                Core.logDebug('新建情景表单重置完成', 'MANAGE');
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
                    <button type="button" class="edit-dialog-operation" data-index="${index}" title="${Core.t('app.edit')}">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button type="button" class="delete-dialog-operation" data-index="${index}" title="${Core.t('app.delete')}">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
        
        // 绑定对话框内的操作事件
        container.querySelectorAll('.edit-dialog-operation').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.currentOperationIndex = index;
                const operation = operations[index];
                this.showOperationEditDialog(operation.type, operation);
            });
        });
        
        container.querySelectorAll('.delete-dialog-operation').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                operations.splice(index, 1);
                
                // 更新相应的操作列表
                if (this.currentScenario) {
                    this.currentScenario.operations = operations;
                } else {
                    this.tempOperations = operations;
                }
                
                this.renderOperationsList(operations);
            });
        });
    }
    
    showOperationEditDialog(type, operation = null) {
        if (Core.isDebugMode()) {
            Core.logDebug(`显示操作编辑对话框: ${type}, 编辑模式: ${operation ? '是' : '否'}`, 'MANAGE');
        }
        
        const titles = {
            install_module: Core.t('manage.installModule'),
            delete_module: Core.t('manage.deleteModule'),
            flash_boot: Core.t('manage.flashBoot'),
            custom_script: Core.t('manage.customScript')
        };
        
        document.getElementById('operation-edit-title').textContent = titles[type] || Core.t('manage.editOperation');
        
        const fieldsContainer = document.getElementById('operation-fields');
        fieldsContainer.innerHTML = this.getOperationFields(type, operation);
        
        // 绑定文件选择事件
        this.setupFileInputs();
        
        if (Core.isDebugMode()) {
            Core.logDebug(`操作编辑对话框字段设置完成: ${type}`, 'MANAGE');
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
                    <fieldset class="switches">
                        <label>
                            <span>${Core.t('manage.operation.fields.anykernel')}</span>
                            <p>${Core.t('manage.operation.fields.anykernelDesc')}</p>
                            <input type="checkbox" name="anykernel" ${operation?.anykernel ? 'checked' : ''}>
                        </label>
                    </fieldset>
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
                Core.showToast(Core.t('manage.export.success').replace('{{count}}', successCount), 'success');
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
            Core.showToast(Core.t('toast.debug.startSaveOperation'), 'info');
            Core.logDebug('MANAGE', '开始保存操作');
        }
        
        const form = document.getElementById('operation-form');
        const formData = new FormData(form);
        
        // 验证必填字段
        const requiredFields = form.querySelectorAll('[required]');
        for (const field of requiredFields) {
            if (!field.value.trim()) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `验证失败: ${field.name} 为空`);
                }
                Core.showToast(Core.t('manage.operation.fieldsRequired'), 'warning');
                field.focus();
                return;
            }
        }
        
        const operation = {
            type: formData.get('type')
        };
        
        if (Core.isDebugMode()) {
            Core.logDebug('MANAGE', `操作类型: ${operation.type}`);
        }
        
        // 根据类型添加特定字段
        switch (operation.type) {
            case 'install_module':
                operation.path = formData.get('path');
                if (!operation.path) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', '安装模块操作: 路径为空');
                    }
                    Core.showToast(Core.t('toast.validation.selectModuleFile'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `安装模块操作: ${operation.path}`);
                }
                break;
            case 'delete_module':
                operation.path = formData.get('path');
                if (!operation.path) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', '删除模块操作: 路径为空');
                    }
                    Core.showToast(Core.t('toast.validation.selectModuleFile'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `删除模块操作: ${operation.path}`);
                }
                break;
            case 'flash_boot':
                operation.path = formData.get('path');
                operation.anykernel = formData.has('anykernel');
                if (!operation.path) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', '刷写Boot操作: 路径为空');
                    }
                    Core.showToast(Core.t('toast.validation.selectImageFile'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `刷写Boot操作: ${operation.path}, AnyKernel: ${operation.anykernel}`);
                }
                break;
            case 'custom_script':
                operation.script = formData.get('script');
                if (!operation.script) {
                    if (Core.isDebugMode()) {
                        Core.logDebug('MANAGE', '自定义脚本操作: 脚本内容为空');
                    }
                    Core.showToast(Core.t('toast.validation.enterScriptContent'), 'warning');
            return;
                }
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `自定义脚本操作: ${operation.script.length} 字符`);
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
                Core.logDebug('MANAGE', `编辑操作索引: ${this.currentOperationIndex}`);
            }
        } else {
            // 添加新操作
            operations.push(operation);
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `添加新操作，总数: ${operations.length}`);
            }
        }
        
        // 更新操作列表显示
        this.renderOperationsList(operations);
        
        // 保存到相应的位置
        if (this.currentScenario) {
            this.currentScenario.operations = operations;
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', '保存到现有情景');
            }
        } else {
            this.tempOperations = operations;
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', '保存到临时操作列表');
            }
        }
        
        this.closeDialogWithAnimation(this.operationEditDialog);
        if (Core.isDebugMode()) {
            Core.showToast(Core.t('toast.debug.operationSaveSuccess'), 'success');
        }
        Core.showToast(Core.t('toast.scenario.operationSaved'), 'success');
    }
    
    async saveScenario() {
        if (Core.isDebugMode()) {
            Core.showToast(Core.t('toast.debug.startSaveScenario'), 'info');
            Core.logDebug('MANAGE', '开始保存情景操作');
        }
        
        const form = document.getElementById('scenario-form');
        const formData = new FormData(form);
        
        const name = formData.get('scenario-name');
        if (!name || !name.trim()) {
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', '保存失败: 情景名称为空');
            }
            Core.showToast(Core.t('toast.validation.enterScenarioName'), 'warning');
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
            Core.logDebug('MANAGE', `情景数据: ID=${scenario.id}, 名称=${scenario.name}, 兼容模式=${scenario.compatibilityMode}, 自动重启=${scenario.autoReboot}, 操作数量=${scenario.operations.length}`);
            Core.showToast(`[DEBUG] 情景包含 ${scenario.operations.length} 个操作`, 'info');
        }
        
        // 显示保存中的提示
        const saveButton = document.querySelector('#edit-dialog fieldset button.filled');
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = '保存中...';
        
        try {
            if (this.currentScenario) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', '更新现有情景: ' + scenario.id);
                }
                await this.scenarioManager.updateScenario(scenario);
            } else {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', '添加新情景: ' + scenario.id);
                }
                await this.scenarioManager.addScenario(scenario);
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', '情景保存成功，关闭对话框并刷新列表');
                Core.showToast(Core.t('toast.debug.scenarioSaveSuccess'), 'success');
            }
            
            this.closeDialogWithAnimation(this.editDialog);
            this.refresh();
            
        } catch (error) {
            console.error('Save scenario error:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `保存情景失败: ${error.message || '未知错误'}`);
                Core.showToast(Core.t('toast.scenario.saveFailed', { error: error.message || '未知错误' }), 'error');
            }
            Core.showToast(Core.t('toast.scenario.saveFailed', { error: error.message || '未知错误' }), 'error');
        } finally {
            // 恢复按钮状态
            saveButton.disabled = false;
            saveButton.textContent = originalText;
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', '恢复保存按钮状态');
            }
        }
    }
    
    async exportScenario(scenarioId) {
        try {
            const exportPath = this.settingsManager.getSetting('exportPath');
            const result = await this.scenarioManager.exportScenario(scenarioId, exportPath);
            Core.showToast(Core.t('toast.scenario.exportSuccess'), 'success');
        } catch (error) {
            Core.showToast(`导出失败: ${error.message}`, 'error');
        }
    }
    
    async deleteScenario(scenarioId) {
        const confirmed = await window.DialogManager.showConfirm(
            Core.t('manage.scenario.deleteTitle'),
            Core.t('manage.scenario.deleteConfirm')
        );
        
        if (confirmed) {
            try {
                await this.scenarioManager.deleteScenario(scenarioId);
                Core.showToast(Core.t('toast.scenario.deleted'), 'success');
                this.refresh();
            } catch (error) {
                console.error('Delete scenario error:', error);
                Core.showToast(Core.t('toast.scenario.deleteFailed', { error: error.message || '未知错误' }), 'error');
            }
        }
    }
    
    async executeScenario(scenarioId) {
        if (Core.isDebugMode()) {
            Core.showToast(Core.t('toast.debug.startExecuteScenario'), 'info');
            Core.logDebug('MANAGE', `开始执行情景: ${scenarioId}`);
        }
        
        try {
            const scenario = this.scenarioManager.getScenario(scenarioId);
            if (!scenario) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `情景不存在: ${scenarioId}`);
                }
                Core.showToast(Core.t('toast.scenario.notFound'), 'error');
            return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `找到情景: ${scenario.name}, 操作数量: ${scenario.operations.length}`);
            }
            
            if (scenario.operations.length === 0) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', '情景没有任何操作');
                }
                Core.showToast(Core.t('toast.scenario.noOperations'), 'warning');
            return;
            }
            
            // 显示确认对话框
            const confirmed = await window.DialogManager.showConfirm(
                '执行情景',
                `确定要执行情景 "${scenario.name}" 吗？\n\n此操作将执行以下内容：\n${scenario.operations.map(op => `• ${this.getOperationTypeName(op.type)}: ${this.getOperationContent(op)}`).join('\n')}${scenario.autoReboot ? '\n\n⚠️ 执行完成后设备将自动重启' : ''}`
            );
            
            if (!confirmed) {
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', '用户取消执行情景');
                }
                return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', '用户确认执行情景，开始执行脚本');
            }
            
            Core.showToast(Core.t('toast.scenario.executing'), 'info');
            
            try {
                const output = await this.scenarioManager.executeScenario(scenarioId);
                console.log('Script execution output:', output);
                
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `脚本执行完成，输出长度: ${output ? output.length : 0}`);
                    if (output && output.trim()) {
                        Core.logDebug('MANAGE', `脚本输出: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`);
                    }
                    Core.showToast(Core.t('toast.debug.scriptExecuteSuccess'), 'success');
                }
                
                Core.showToast(Core.t('toast.scenario.executeSuccess'), 'success');
                
                // 显示执行结果
                if (output && output.trim()) {
                    console.log('Scenario execution completed:', output);
                }
                
            } catch (executeError) {
                console.error('Script execution failed:', executeError);
                if (Core.isDebugMode()) {
                    Core.logDebug('MANAGE', `脚本执行失败: ${executeError.message}`);
                    Core.showToast(Core.t('toast.debug.scriptExecuteFailed', { error: executeError.message }), 'error');
                }
                Core.showToast(Core.t('toast.scenario.executeFailed', { error: executeError.message }), 'error');
            }
            
        } catch (error) {
            console.error('Execute scenario error:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('MANAGE', `执行情景时发生错误: ${error.message}`);
                Core.showToast(Core.t('toast.debug.executeError', { error: error.message }), 'error');
            }
            Core.showToast(Core.t('toast.scenario.executeError', { error: error.message }), 'error');
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
            Core.t('manage.operation.deleteTitle'),
            Core.t('manage.operation.deleteConfirm')
        );
        
        if (confirmed) {
            try {
                const scenario = this.scenarioManager.getScenario(scenarioId);
                if (scenario) {
                    scenario.operations.splice(operationIndex, 1);
                    await this.scenarioManager.updateScenario(scenario);
                    Core.showToast(Core.t('toast.operation.deleted'), 'success');
                    this.refresh();
                }
            } catch (error) {
                console.error('Delete operation error:', error);
                Core.showToast(Core.t('toast.operation.deleteFailed', { error: error.message || '未知错误' }), 'error');
            }
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}