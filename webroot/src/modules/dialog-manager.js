class DialogManager {
    constructor() {
        this.confirmDialog = document.getElementById('confirm-dialog');
        this.confirmTitle = document.getElementById('confirm-title');
        this.confirmContent = document.getElementById('confirm-content');
        this.confirmCancel = document.getElementById('confirm-cancel');
        this.confirmOk = document.getElementById('confirm-ok');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
            window.Core.logDebug('DialogManager event listeners setup completed', 'DIALOG');
        }
        
        // 确认对话框事件
        this.confirmCancel.addEventListener('click', () => {
            if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                window.Core.logDebug('User clicked cancel button', 'DIALOG');
            }
            this.closeDialogWithAnimation(this.confirmDialog);
        });
    }
    
    showDialogWithAnimation(dialog) {
        if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
            window.Core.logDebug(`Start showing dialog animation: ${dialog.id}`, 'DIALOG');
        }
        
        dialog.showModal();
        // 触发进入动画
        setTimeout(() => {
            dialog.classList.add('showing');
            if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                window.Core.logDebug(`Dialog show animation completed: ${dialog.id}`, 'DIALOG');
            }
        }, 10);
    }
    
    closeDialogWithAnimation(dialog) {
        if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
            window.Core.logDebug(`Start closing dialog animation: ${dialog.id}`, 'DIALOG');
        }
        
        dialog.classList.remove('showing');
        dialog.classList.add('closing');
        
        // 等待动画完成后关闭对话框
        setTimeout(() => {
            dialog.close();
            dialog.classList.remove('closing');
            if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                window.Core.logDebug(`Dialog close animation completed: ${dialog.id}`, 'DIALOG');
            }
        }, 200); // 与CSS动画时间一致
    }
    
    /**
     * 显示确认对话框
     * @param {string} title - 对话框标题
     * @param {string} content - 对话框内容
     * @returns {Promise<boolean>} - 用户选择结果
     */
    showConfirm(title, content) {
        // 检查Core是否可用以及是否为debug模式
        if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
            window.Core.logDebug('DIALOG', `Show confirmation dialog: ${title}`);
            window.Core.showToast('[DEBUG] Showing confirm dialog', 'info');
        }
        
        return new Promise((resolve) => {
            this.confirmTitle.textContent = title;
            this.confirmContent.textContent = content;
            
            // 移除之前的事件监听器
            const newConfirmOk = this.confirmOk.cloneNode(true);
            this.confirmOk.parentNode.replaceChild(newConfirmOk, this.confirmOk);
            this.confirmOk = newConfirmOk;
            
            // 添加新的事件监听器
            this.confirmOk.addEventListener('click', () => {
                if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                    window.Core.logDebug('DIALOG', 'User clicked confirm');
                }
                this.closeDialogWithAnimation(this.confirmDialog);
                resolve(true);
            });
            
            // 处理对话框关闭事件
            const handleClose = () => {
                if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                    window.Core.logDebug('DIALOG', 'Dialog closed, user cancelled');
                }
                this.confirmDialog.removeEventListener('close', handleClose);
                resolve(false);
            };
            
            this.confirmDialog.addEventListener('close', handleClose);
            this.showDialogWithAnimation(this.confirmDialog);
        });
    }
    

    
    /**
     * 选择文件的通用方法 - 使用内置文件浏览器
     * @param {string} accept - 接受的文件类型
     * @returns {Promise<string|null>} - 选择的文件路径
     */
    async selectFile(accept = '*') {
        // 文件选择功能已移除，用户需要手动输入路径
        throw new Error('文件选择功能已移除，请手动输入文件路径');
    }
}

// 创建全局实例
window.DialogManager = new DialogManager();