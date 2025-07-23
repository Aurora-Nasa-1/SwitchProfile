import { Core } from '../core.js';

export class HomePage {
    constructor(scenarioManager, settingsManager) {
        this.scenarioManager = scenarioManager;
        this.settingsManager = settingsManager;
        this.container = document.getElementById('scenario-list');
        this.boundApplyScenario = this.handleApplyScenario.bind(this);
    }
    
    refresh() {
        if (Core.isDebugMode()) {
            Core.logDebug('刷新主页内容', 'HOME');
        }
        this.render();
    }
    
    render() {
        const scenarios = this.scenarioManager.getScenarios();
        
        if (Core.isDebugMode()) {
            Core.logDebug(`开始渲染主页，情景数量: ${scenarios.length}`, 'HOME');
        }
        
        if (scenarios.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--on-surface-variant);">
                    <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 1rem;">folder_open</span>
                    <h3>暂无情景</h3>
                    <p>点击管理页面的 + 按钮创建第一个情景</p>
                </div>
            `;
            if (Core.isDebugMode()) {
                Core.logDebug('显示空状态页面', 'HOME');
            }
            return;
        }
        
        this.container.innerHTML = scenarios.map(scenario => this.createScenarioCard(scenario)).join('');
        
        if (Core.isDebugMode()) {
            Core.logDebug(`情景卡片渲染完成，共 ${scenarios.length} 个情景`, 'HOME');
        }
        
        // 绑定事件
        this.bindEvents();
    }
    
    createScenarioCard(scenario) {
        const operationsCount = scenario.operations.length;
        const operationsText = operationsCount > 0 ? Core.t('home.operationsCount', { count: operationsCount }) : Core.t('home.noOperations');
        
        return `
            <div class="scenario-card" data-id="${scenario.id}">
                <h3>${this.escapeHtml(scenario.name)}</h3>
                <p>${operationsText}</p>
                <div class="scenario-details">
                    ${scenario.operations.slice(0, 3).map(op => `
                        <div style="font-size: 0.85rem; color: var(--on-surface-variant);">
                            <span style="color: var(--primary); font-weight: 500;">${this.getOperationTypeName(op.type)}</span>
                            ${this.getOperationSummary(op)}
                        </div>
                    `).join('')}
                    ${scenario.operations.length > 3 ? `<div style="font-size: 0.85rem; color: var(--on-surface-variant);">...还有 ${scenario.operations.length - 3} 个操作</div>` : ''}
                </div>
                <fieldset>
                    <button type="button" class="apply-scenario filled" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">play_arrow</span>
                        应用情景
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
    
    getOperationSummary(operation) {
        switch (operation.type) {
            case 'install_module':
                return operation.path ? `: ${operation.path.split('/').pop()}` : '';
            case 'delete_module':
                return operation.path ? `: ${operation.path.split('/').pop()}` : '';
            case 'flash_boot':
                return operation.path ? `: ${operation.path.split('/').pop()}` : '';
            case 'custom_script':
                return operation.script ? `: ${operation.script.substring(0, 30)}...` : '';
            default:
                return '';
        }
    }
    
    bindEvents() {
        if (Core.isDebugMode()) {
            Core.logDebug('开始绑定主页事件监听器', 'HOME');
        }
        
        // 移除旧的事件监听器
        this.container.removeEventListener('click', this.boundApplyScenario);
        
        // 使用事件委托绑定新的事件监听器
        this.container.addEventListener('click', this.boundApplyScenario);
        
        if (Core.isDebugMode()) {
            Core.logDebug('主页事件监听器绑定完成', 'HOME');
        }
    }
    
    handleApplyScenario(e) {
        const button = e.target.closest('.apply-scenario');
        if (!button) return;
        
        const scenarioId = button.closest('[data-id]').dataset.id;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`用户点击应用情景按钮: ${scenarioId}`, 'HOME');
        }
        
        this.applyScenario(scenarioId);
    }
    
    async applyScenario(scenarioId) {
        if (Core.isDebugMode()) {
            Core.showToast(Core.t('toast.debug.startApplyScenario'), 'info');
            Core.logDebug('HOME', `开始应用情景: ${scenarioId}`);
        }
        
        try {
            const scenario = this.scenarioManager.getScenario(scenarioId);
            if (!scenario) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', `情景不存在: ${scenarioId}`);
                }
                Core.showToast(Core.t('toast.scenario.notFound'), 'error');
            return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('HOME', `找到情景: ${scenario.name}, 操作数量: ${scenario.operations.length}`);
            }
            
            if (scenario.operations.length === 0) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', '情景没有任何操作');
                }
                Core.showToast(Core.t('toast.scenario.noOperations'), 'warning');
            return;
            }
            
            // 检查是否需要确认
            let confirmed = true;
            if (this.settingsManager && !this.settingsManager.shouldSkipConfirm()) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', '显示确认对话框');
                }
                // 显示确认对话框
                const confirmContent = `此操作将执行以下内容：\n${scenario.operations.map(op => `• ${this.getOperationTypeName(op.type)}: ${this.getOperationSummary(op)}`).join('\n')}${scenario.autoReboot ? '\n\n⚠️ 执行完成后设备将自动重启' : ''}`;
                
                confirmed = await window.DialogManager.showConfirm(
                    `应用情景 "${scenario.name}"`,
                    confirmContent
                );
            } else {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', '跳过确认对话框');
                }
            }
            
            if (!confirmed) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', '用户取消应用情景');
                }
                return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('HOME', '用户确认应用情景，开始执行');
            }
            
            Core.showToast(Core.t('toast.scenario.applying'), 'info');
            
            // 直接执行脚本文件
            try {
                const output = await this.scenarioManager.executeScenario(scenarioId);
                console.log('Script execution output:', output);
                
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', `情景应用完成，输出长度: ${output ? output.length : 0}`);
                    if (output && output.trim()) {
                        Core.logDebug('HOME', `执行输出: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`);
                    }
                    Core.showToast(Core.t('toast.debug.scenarioApplySuccess'), 'success');
                }
                
                Core.showToast(Core.t('toast.scenario.applySuccess'), 'success');
                
                // 显示执行结果
                if (output && output.trim()) {
                    console.log('Scenario execution completed:', output);
                }
                
            } catch (executeError) {
                console.error('Script execution failed:', executeError);
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', `情景应用失败: ${executeError.message}`);
                    Core.showToast(Core.t('toast.debug.applyFailed', { error: executeError.message }), 'error');
                }
                Core.showToast(Core.t('toast.scenario.applyFailed', { error: executeError.message }), 'error');
            }
            
        } catch (error) {
            console.error('Apply scenario error:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('HOME', `应用情景时发生错误: ${error.message}`);
                Core.showToast(Core.t('toast.debug.applyError', { error: error.message }), 'error');
            }
            Core.showToast(Core.t('toast.scenario.applyError', { error: error.message }), 'error');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}