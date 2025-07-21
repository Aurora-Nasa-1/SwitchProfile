import { Core } from '../core.js';

export class ManagePage {
    constructor(scenarioManager, fileManager) {
        this.scenarioManager = scenarioManager;
        this.fileManager = fileManager;
        this.container = document.getElementById('manage-list');
        this.editDialog = document.getElementById('edit-dialog');
        this.operationDialog = document.getElementById('operation-dialog');
        this.operationEditDialog = document.getElementById('operation-edit-dialog');
        
        this.currentScenario = null;
        this.currentOperationIndex = -1;
        
        this.setupDialogs();
    }
    
    setupDialogs() {
        // 编辑对话框事件
        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.editDialog.close();
        });
        
        document.getElementById('scenario-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveScenario();
        });
        
        // 操作类型选择对话框事件
        document.getElementById('cancel-operation').addEventListener('click', () => {
            this.operationDialog.close();
        });
        
        this.operationDialog.querySelectorAll('.operation-type-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const type = e.target.closest('[data-type]').dataset.type;
                this.operationDialog.close();
                this.showOperationEditDialog(type);
            });
        });
        
        // 操作编辑对话框事件
        document.getElementById('cancel-operation-edit').addEventListener('click', () => {
            this.operationEditDialog.close();
        });
        
        document.getElementById('operation-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveOperation();
        });
        
        // 添加操作按钮事件
        document.getElementById('add-operation').addEventListener('click', () => {
            this.currentOperationIndex = -1;
            this.operationDialog.showModal();
        });
    }
    
    refresh() {
        this.render();
    }
    
    render() {
        const scenarios = this.scenarioManager.getScenarios();
        
        if (scenarios.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--on-surface-variant);">
                    <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 1rem;">add_circle</span>
                    <h3>开始创建情景</h3>
                    <p>点击右下角的 + 按钮创建第一个情景</p>
                </div>
            `;
            return;
        }
        
        this.container.innerHTML = scenarios.map(scenario => this.createManageCard(scenario)).join('');
        
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
                            <div class="operation-actions">
                                <button type="button" class="edit-operation" data-index="${index}" title="编辑">
                                    <span class="material-symbols-rounded">edit</span>
                                </button>
                                <button type="button" class="delete-operation" data-index="${index}" title="删除">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <fieldset>
                    <button type="button" class="delete-scenario" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">delete</span>
                        删除
                    </button>
                    <button type="button" class="execute-scenario tonal" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">play_arrow</span>
                        执行脚本
                    </button>
                    <button type="button" class="edit-scenario filled" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">edit</span>
                        编辑
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
        // 使用事件委托来处理动态生成的按钮
        this.container.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const scenarioCard = target.closest('.scenario-card');
            if (!scenarioCard) return;
            
            const scenarioId = scenarioCard.dataset.id;
            
            if (target.classList.contains('edit-scenario')) {
                this.showEditDialog(scenarioId);
            } else if (target.classList.contains('delete-scenario')) {
                this.deleteScenario(scenarioId);
            } else if (target.classList.contains('execute-scenario')) {
                this.executeScenario(scenarioId);
            } else if (target.classList.contains('edit-operation')) {
                const operationIndex = parseInt(target.dataset.index);
                this.editOperation(scenarioId, operationIndex);
            } else if (target.classList.contains('delete-operation')) {
                const operationIndex = parseInt(target.dataset.index);
                this.deleteOperation(scenarioId, operationIndex);
            }
        });
    }
    
    showEditDialog(scenarioId = null) {
        this.currentScenario = scenarioId ? this.scenarioManager.getScenario(scenarioId) : null;
        this.currentOperationIndex = -1; // 重置操作索引
        
        // 设置对话框标题
        document.getElementById('dialog-title').textContent = scenarioId ? '编辑情景' : '新建情景';
        
        // 填充表单
        if (this.currentScenario) {
            document.getElementById('scenario-name').value = this.currentScenario.name;
            document.getElementById('compatibility-mode').checked = this.currentScenario.compatibilityMode;
            document.getElementById('auto-reboot').checked = this.currentScenario.autoReboot;
            // 为编辑情景创建操作列表的副本，避免直接修改原始数据
            this.currentScenario.operations = [...this.currentScenario.operations];
            this.renderOperationsList(this.currentScenario.operations);
        } else {
            document.getElementById('scenario-form').reset();
            this.tempOperations = []; // 重置临时操作列表
            this.renderOperationsList([]);
        }
        
        this.editDialog.showModal();
    }
    
    renderOperationsList(operations) {
        const container = document.getElementById('operations-list');
        
        if (operations.length === 0) {
            container.innerHTML = '<p style="color: var(--on-surface-variant); text-align: center; padding: 1rem;">暂无操作，点击下方按钮添加</p>';
            return;
        }
        
        container.innerHTML = operations.map((op, index) => `
            <div class="operation-item" data-index="${index}">
                <div class="operation-type">${this.getOperationTypeName(op.type)}</div>
                <div class="operation-content">${this.getOperationContent(op)}</div>
                <div class="operation-actions">
                    <button type="button" class="edit-dialog-operation" data-index="${index}" title="编辑">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button type="button" class="delete-dialog-operation" data-index="${index}" title="删除">
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
        const titles = {
            install_module: '安装模块',
            delete_module: '删除模块',
            flash_boot: '刷入Boot镜像',
            custom_script: '自定义脚本'
        };
        
        document.getElementById('operation-edit-title').textContent = titles[type] || '编辑操作';
        
        const fieldsContainer = document.getElementById('operation-fields');
        fieldsContainer.innerHTML = this.getOperationFields(type, operation);
        
        // 绑定文件选择事件
        this.setupFileInputs();
        
        this.operationEditDialog.showModal();
    }
    
    getOperationFields(type, operation = null) {
        switch (type) {
            case 'install_module':
                return `
                    <input type="hidden" name="type" value="install_module">
                    <label>
                        <span>模块路径</span>
                        <input type="text" id="path" name="path" value="${operation?.path || ''}" required>
                    </label>
                    <div class="file-input-wrapper">
                        <button type="button" class="tonal file-select-btn" data-target="path" data-accept=".zip">
                            <span class="material-symbols-rounded">folder_open</span>
                            选择文件
                        </button>
                        <input type="file" accept=".zip" style="display: none;">
                    </div>
                `;
            case 'delete_module':
                return `
                    <input type="hidden" name="type" value="delete_module">
                    <label>
                        <span>模块路径</span>
                        <input type="text" id="path" name="path" value="${operation?.path || ''}" required>
                    </label>
                    <div class="file-input-wrapper">
                        <button type="button" class="tonal file-select-btn" data-target="path" data-accept=".zip">
                            <span class="material-symbols-rounded">folder_open</span>
                            选择文件
                        </button>
                        <input type="file" accept=".zip" style="display: none;">
                    </div>
                `;
            case 'flash_boot':
                return `
                    <input type="hidden" name="type" value="flash_boot">
                    <label>
                        <span>镜像路径</span>
                        <input type="text" id="path" name="path" value="${operation?.path || ''}" required>
                    </label>
                    <div class="file-input-wrapper">
                        <button type="button" class="tonal file-select-btn" data-target="path" data-accept=".img,.zip">
                            <span class="material-symbols-rounded">folder_open</span>
                            选择文件
                        </button>
                        <input type="file" accept=".img,.zip" style="display: none;">
                    </div>
                    <fieldset class="switches">
                        <label>
                            <span>AnyKernel3格式</span>
                            <p>使用AnyKernel3格式刷入</p>
                            <input type="checkbox" name="anykernel" ${operation?.anykernel ? 'checked' : ''}>
                        </label>
                    </fieldset>
                `;
            case 'custom_script':
                return `
                    <input type="hidden" name="type" value="custom_script">
                    <label>
                        <span>脚本内容</span>
                        <textarea name="script" rows="6" required>${operation?.script || ''}</textarea>
                    </label>
                `;
            default:
                return '<p>未知操作类型</p>';
        }
    }
    
    setupFileInputs() {
        const fileButtons = document.querySelectorAll('[data-target]');
        
        fileButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const targetId = button.getAttribute('data-target');
                const targetInput = document.getElementById(targetId);
                
                if (!targetInput) {
                    console.error('Target input not found:', targetId);
                    Core.showToast('目标输入框未找到', 'error');
                    return;
                }
                
                const accept = targetInput.getAttribute('accept') || '*';
                
                try {
                    const selectedFilePath = await window.DialogManager.selectFile(accept);
                    
                    if (selectedFilePath) {
                        // 获取文件名
                        const fileName = selectedFilePath.split('/').pop();
                        const targetPath = `modules/${fileName}`;
                        
                        // 复制文件到模块目录
                        const copyCommand = `cp "${selectedFilePath}" "${targetPath}"`;
                        
                        Core.execCommand(copyCommand, (output) => {
                            if (output.includes('ERROR')) {
                                console.error('File copy failed:', output);
                                Core.showToast('文件复制失败', 'error');
                            } else {
                                button.textContent = fileName;
                                targetInput.value = targetPath;
                                Core.showToast('文件选择成功', 'success');
                            }
                        });
                    }
                } catch (error) {
                    console.error('File selection failed:', error);
                    Core.showToast('文件选择失败', 'error');
                }
            });
        });
    }
    
    saveOperation() {
        const form = document.getElementById('operation-form');
        const formData = new FormData(form);
        
        // 验证必填字段
        const requiredFields = form.querySelectorAll('[required]');
        for (const field of requiredFields) {
            if (!field.value.trim()) {
                Core.showToast('请填写所有必填字段', 'warning');
                field.focus();
                return;
            }
        }
        
        const operation = {
            type: formData.get('type')
        };
        
        // 根据类型添加特定字段
        switch (operation.type) {
            case 'install_module':
                operation.path = formData.get('path');
                if (!operation.path) {
                    Core.showToast('请选择模块文件', 'warning');
                    return;
                }
                break;
            case 'delete_module':
                operation.path = formData.get('path');
                if (!operation.path) {
                    Core.showToast('请选择模块文件', 'warning');
                    return;
                }
                break;
            case 'flash_boot':
                operation.path = formData.get('path');
                operation.anykernel = formData.has('anykernel');
                if (!operation.path) {
                    Core.showToast('请选择镜像文件', 'warning');
                    return;
                }
                break;
            case 'custom_script':
                operation.script = formData.get('script');
                if (!operation.script) {
                    Core.showToast('请输入脚本内容', 'warning');
                    return;
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
        } else {
            // 添加新操作
            operations.push(operation);
        }
        
        // 更新操作列表显示
        this.renderOperationsList(operations);
        
        // 保存到相应的位置
        if (this.currentScenario) {
            this.currentScenario.operations = operations;
        } else {
            this.tempOperations = operations;
        }
        
        this.operationEditDialog.close();
        Core.showToast('操作已保存', 'success');
    }
    
    async saveScenario() {
        const form = document.getElementById('scenario-form');
        const formData = new FormData(form);
        
        const name = formData.get('scenario-name');
        if (!name || !name.trim()) {
            Core.showToast('请输入情景名称', 'warning');
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
        
        // 显示保存中的提示
        const saveButton = form.querySelector('button[type="submit"]');
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = '保存中...';
        
        try {
            if (this.currentScenario) {
                await this.scenarioManager.updateScenario(scenario);
                Core.showToast('情景已更新', 'success');
            } else {
                await this.scenarioManager.addScenario(scenario);
                Core.showToast('情景已创建', 'success');
            }
            
            this.editDialog.close();
            this.refresh();
            
        } catch (error) {
            console.error('Save scenario error:', error);
            Core.showToast('保存失败: ' + (error.message || '未知错误'), 'error');
        } finally {
            // 恢复按钮状态
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }
    
    async deleteScenario(scenarioId) {
        const confirmed = await window.DialogManager.showConfirm(
            '删除情景',
            '确定要删除这个情景吗？此操作无法撤销。'
        );
        
        if (confirmed) {
            try {
                await this.scenarioManager.deleteScenario(scenarioId);
                Core.showToast('情景已删除', 'success');
                this.refresh();
            } catch (error) {
                console.error('Delete scenario error:', error);
                Core.showToast('删除失败: ' + (error.message || '未知错误'), 'error');
            }
        }
    }
    
    async executeScenario(scenarioId) {
        try {
            const scenario = this.scenarioManager.getScenario(scenarioId);
            if (!scenario) {
                Core.showToast('情景不存在', 'error');
                return;
            }
            
            if (scenario.operations.length === 0) {
                Core.showToast('该情景没有任何操作', 'warning');
                return;
            }
            
            // 显示确认对话框
            const confirmed = await window.DialogManager.showConfirm(
                '执行情景',
                `确定要执行情景 "${scenario.name}" 吗？\n\n此操作将执行以下内容：\n${scenario.operations.map(op => `• ${this.getOperationTypeName(op.type)}: ${this.getOperationContent(op)}`).join('\n')}${scenario.autoReboot ? '\n\n⚠️ 执行完成后设备将自动重启' : ''}`
            );
            
            if (!confirmed) {
                return;
            }
            
            Core.showToast('正在执行脚本...', 'info');
            
            try {
                const output = await this.scenarioManager.executeScenario(scenarioId);
                console.log('Script execution output:', output);
                
                Core.showToast('脚本执行成功！', 'success');
                
                // 显示执行结果
                if (output && output.trim()) {
                    console.log('Scenario execution completed:', output);
                }
                
            } catch (executeError) {
                console.error('Script execution failed:', executeError);
                Core.showToast('脚本执行失败: ' + executeError.message, 'error');
            }
            
        } catch (error) {
            console.error('Execute scenario error:', error);
            Core.showToast('执行脚本时发生错误: ' + error.message, 'error');
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
            '删除操作',
            '确定要删除这个操作吗？此操作无法撤销。'
        );
        
        if (confirmed) {
            try {
                const scenario = this.scenarioManager.getScenario(scenarioId);
                if (scenario) {
                    scenario.operations.splice(operationIndex, 1);
                    await this.scenarioManager.updateScenario(scenario);
                    Core.showToast('操作已删除', 'success');
                    this.refresh();
                }
            } catch (error) {
                console.error('Delete operation error:', error);
                Core.showToast('删除失败: ' + (error.message || '未知错误'), 'error');
            }
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}