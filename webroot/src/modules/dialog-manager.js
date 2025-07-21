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
        // 确认对话框事件
        this.confirmCancel.addEventListener('click', () => {
            this.confirmDialog.close();
        });
    }
    
    /**
     * 显示确认对话框
     * @param {string} title - 对话框标题
     * @param {string} content - 对话框内容
     * @returns {Promise<boolean>} - 用户选择结果
     */
    showConfirm(title, content) {
        return new Promise((resolve) => {
            this.confirmTitle.textContent = title;
            this.confirmContent.textContent = content;
            
            // 移除之前的事件监听器
            const newConfirmOk = this.confirmOk.cloneNode(true);
            this.confirmOk.parentNode.replaceChild(newConfirmOk, this.confirmOk);
            this.confirmOk = newConfirmOk;
            
            // 添加新的事件监听器
            this.confirmOk.addEventListener('click', () => {
                this.confirmDialog.close();
                resolve(true);
            });
            
            // 处理对话框关闭事件
            const handleClose = () => {
                this.confirmDialog.removeEventListener('close', handleClose);
                resolve(false);
            };
            
            this.confirmDialog.addEventListener('close', handleClose);
            this.confirmDialog.showModal();
        });
    }
    

    

    
    /**
     * 选择文件的通用方法
     * @param {string} accept - 接受的文件类型
     * @returns {Promise<string|null>} - 返回文件路径而不是File对象
     */
    async selectFile(accept = '*') {
        // 直接使用内置文件浏览器
        if (window.FileBrowser) {
            try {
                return await window.FileBrowser.show(accept);
            } catch (error) {
                console.error('File browser failed:', error);
                throw new Error('文件选择失败: ' + error.message);
            }
        } else {
            throw new Error('文件浏览器未初始化');
        }
    }
}

// 创建全局实例
window.DialogManager = new DialogManager();