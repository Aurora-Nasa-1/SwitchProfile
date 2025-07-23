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
            Core.logDebug('Refresh home page content', 'HOME');
        }
        this.render();
    }
    
    render() {
        const scenarios = this.scenarioManager.getScenarios();
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Start rendering home page, scenario count: ${scenarios.length}`, 'HOME');
        }
        
        if (scenarios.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--on-surface-variant);">
                    <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 1rem;">folder_open</span>
                    <h3>${Core.t('home.empty.title')}</h3>
                </div>
            `;
            if (Core.isDebugMode()) {
                Core.logDebug('Show empty state page', 'HOME');
            }
            return;
        }
        
        this.container.innerHTML = scenarios.map(scenario => this.createScenarioCard(scenario)).join('');
        
        if (Core.isDebugMode()) {
            Core.logDebug(`Scenario cards rendered, total ${scenarios.length} scenarios`, 'HOME');
        }
        
        // 绑定事件
        this.bindEvents();
    }
    
    createScenarioCard(scenario) {
        const operationsCount = scenario.operations.length;
        const operationsText = operationsCount > 0 ? Core.t('messages.common.operationsCount', { count: operationsCount }) : Core.t('manage.operation.none');
        
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
                    ${scenario.operations.length > 3 ? `<div style="font-size: 0.85rem; color: var(--on-surface-variant);">... ${scenario.operations.length - 3} more operations</div>` : ''}
                </div>
                <fieldset>
                    <button type="button" class="apply-scenario filled" data-id="${scenario.id}">
                        <span class="material-symbols-rounded">play_arrow</span>
                        ${Core.t('app.actions.apply')}
                    </button>
                </fieldset>
            </div>
        `;
    }
    
    getOperationTypeName(type) {
        const names = {
            install_module: `${Core.t('manage.operation.types.install_module')},`,
            delete_module: `${Core.t('manage.operation.types.delete_module')},`,
            flash_boot: `${Core.t('manage.operation.types.flash_boot')},`,
            custom_script: `${Core.t('manage.operation.types.custom_script')}`
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
            Core.logDebug('Start binding home page event listeners', 'HOME');
        }
        
        // 移除旧的事件监听器
        this.container.removeEventListener('click', this.boundApplyScenario);
        
        // 使用事件委托绑定新的事件监听器
        this.container.addEventListener('click', this.boundApplyScenario);
        
        if (Core.isDebugMode()) {
            Core.logDebug('Home page event listeners bound', 'HOME');
        }
    }
    
    handleApplyScenario(e) {
        const button = e.target.closest('.apply-scenario');
        if (!button) return;
        
        const scenarioId = button.closest('[data-id]').dataset.id;
        
        if (Core.isDebugMode()) {
            Core.logDebug(`User clicked apply scenario button: ${scenarioId}`, 'HOME');
        }
        
        this.applyScenario(scenarioId);
    }
    
    async applyScenario(scenarioId) {
        if (Core.isDebugMode()) {
            Core.showToast('[DEBUG] Starting to apply scenario', 'info');
            Core.logDebug('HOME', `Start applying scenario: ${scenarioId}`);
        }
        
        try {
            const scenario = this.scenarioManager.getScenario(scenarioId);
            if (!scenario) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', `Scenario not found: ${scenarioId}`);
                }
                Core.showToast(Core.t('messages.errors.fileNotFound'), 'error');
            return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('HOME', `Found scenario: ${scenario.name}, operations: ${scenario.operations.length}`);
            }
            
            if (scenario.operations.length === 0) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', 'Scenario has no operations');
                }
                Core.showToast(Core.t('manage.operation.none'), 'warning');
            return;
            }
            
            // 检查是否需要确认
            let confirmed = true;
            if (this.settingsManager && !this.settingsManager.shouldSkipConfirm()) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', 'Show confirmation dialog');
                }
                // 显示确认对话框
                const confirmContent = Core.t('manage.scenario.confirmContent', { operations: scenario.operations.map(op => `• ${this.getOperationTypeName(op.type)}: ${this.getOperationSummary(op)}`).join('\n') });
                
                confirmed = await window.DialogManager.showConfirm(
                    `${Core.t('messages.common.executing')} "${scenario.name}"`,
                    confirmContent
                );
            } else {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', 'Skip confirmation dialog');
                }
            }
            
            if (!confirmed) {
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', 'User cancelled scenario application');
                }
                return;
            }
            
            if (Core.isDebugMode()) {
                Core.logDebug('HOME', 'User confirmed scenario application, start execution');
            }
            
            Core.showToast(Core.t('messages.common.executing'), 'info');
            
            // 直接执行脚本文件
            try {
                const output = await this.scenarioManager.executeScenario(scenarioId);
                console.log('Script execution output:', output);
                
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', `Scenario application completed, output length: ${output ? output.length : 0}`);
                    if (output && output.trim()) {
                        Core.logDebug('HOME', `Execution output: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`);
                    }
                    Core.showToast('[DEBUG] Scenario applied successfully', 'success');
                }
                
                Core.showToast(Core.t('messages.common.success'), 'success');
                
                // 显示执行结果
                if (output && output.trim()) {
                    console.log('Scenario execution completed:', output);
                }
                
            } catch (executeError) {
                console.error('Script execution failed:', executeError);
                if (Core.isDebugMode()) {
                    Core.logDebug('HOME', `Scenario application failed: ${executeError.message}`);
                    Core.showToast(`[DEBUG] Apply failed: ${executeError.message}`, 'error');
                }
                Core.showToast(Core.t('messages.common.failed', { error: executeError.message }), 'error');
            }
            
        } catch (error) {
            console.error('Apply scenario error:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('HOME', `Error occurred while applying scenario: ${error.message}`);
                Core.showToast(`[DEBUG] Apply error: ${error.message}`, 'error');
            }
            Core.showToast(Core.t('messages.common.failed', { error: error.message }), 'error');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}