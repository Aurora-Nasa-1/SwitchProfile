import { Core } from '../core.js';

export class HomePage {
    constructor(scenarioManager) {
        this.scenarioManager = scenarioManager;
        this.container = document.getElementById('scenario-list');
    }
    
    refresh() {
        this.render();
    }
    
    render() {
        const scenarios = this.scenarioManager.getScenarios();
        
        if (scenarios.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--on-surface-variant);">
                    <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 1rem;">folder_open</span>
                    <h3>暂无情景</h3>
                    <p>点击管理页面的 + 按钮创建第一个情景</p>
                </div>
            `;
            return;
        }
        
        this.container.innerHTML = scenarios.map(scenario => this.createScenarioCard(scenario)).join('');
        
        // 绑定事件
        this.bindEvents();
    }
    
    createScenarioCard(scenario) {
        const operationsCount = scenario.operations.length;
        const operationsText = operationsCount > 0 ? `${operationsCount} 个操作` : '无操作';
        
        return `
            <div class="scenario-card" data-id="${scenario.id}">
                <h3>${this.escapeHtml(scenario.name)}</h3>
                <p>${operationsText}</p>
                <div class="scenario-details">
                    ${scenario.operations.slice(0, 3).map(op => `
                        <div style="font-size: 0.75rem; color: var(--on-surface-variant); margin-bottom: 0.25rem;">
                            <span style="color: var(--primary); font-weight: 500;">${this.getOperationTypeName(op.type)}</span>
                            ${this.getOperationSummary(op)}
                        </div>
                    `).join('')}
                    ${scenario.operations.length > 3 ? `<div style="font-size: 0.75rem; color: var(--on-surface-variant);">...还有 ${scenario.operations.length - 3} 个操作</div>` : ''}
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
        const applyButtons = this.container.querySelectorAll('.apply-scenario');
        
        applyButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const scenarioId = e.target.closest('[data-id]').dataset.id;
                await this.applyScenario(scenarioId);
            });
        });
    }
    
    async applyScenario(scenarioId) {
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
            const confirmContent = `此操作将执行以下内容：\n${scenario.operations.map(op => `• ${this.getOperationTypeName(op.type)}: ${this.getOperationSummary(op)}`).join('\n')}${scenario.autoReboot ? '\n\n⚠️ 执行完成后设备将自动重启' : ''}`;
            
            const confirmed = await window.DialogManager.showConfirm(
                `应用情景 "${scenario.name}"`,
                confirmContent
            );
            
            if (!confirmed) {
                return;
            }
            
            Core.showToast('正在应用情景...', 'info');
            
            // 直接执行脚本文件
            try {
                const output = await this.scenarioManager.executeScenario(scenarioId);
                console.log('Script execution output:', output);
                
                Core.showToast('情景应用成功！', 'success');
                
                // 显示执行结果
                if (output && output.trim()) {
                    console.log('Scenario execution completed:', output);
                }
                
            } catch (executeError) {
                console.error('Script execution failed:', executeError);
                Core.showToast('情景应用失败: ' + executeError.message, 'error');
            }
            
        } catch (error) {
            console.error('Apply scenario error:', error);
            Core.showToast('应用情景时发生错误: ' + error.message, 'error');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}