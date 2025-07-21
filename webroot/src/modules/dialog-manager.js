class DialogManager {
    constructor() {
        this.confirmDialog = document.getElementById('confirm-dialog');
        this.confirmTitle = document.getElementById('confirm-title');
        this.confirmContent = document.getElementById('confirm-content');
        this.confirmCancel = document.getElementById('confirm-cancel');
        this.confirmOk = document.getElementById('confirm-ok');
        
        this.filePickerDialog = document.getElementById('file-picker-dialog');
        this.fileDropZone = document.querySelector('.file-drop-zone');
        this.fallbackFileInput = document.getElementById('fallback-file-input');
        this.selectFileBtn = document.getElementById('select-file-btn');
        this.selectedFileInfo = document.getElementById('selected-file-info');
        this.selectedFileName = document.getElementById('selected-file-name');
        this.filePickerCancel = document.getElementById('file-picker-cancel');
        this.filePickerOk = document.getElementById('file-picker-ok');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 确认对话框事件
        this.confirmCancel.addEventListener('click', () => {
            this.confirmDialog.close();
        });
        
        // 文件选择器事件
        this.filePickerCancel.addEventListener('click', () => {
            this.filePickerDialog.close();
        });
        
        this.selectFileBtn.addEventListener('click', () => {
            this.fallbackFileInput.click();
        });
        
        this.fallbackFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelected(e.target.files[0]);
            }
        });
        
        // 拖拽事件
        this.fileDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.fileDropZone.classList.add('drag-over');
        });
        
        this.fileDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.fileDropZone.classList.remove('drag-over');
        });
        
        this.fileDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.fileDropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelected(e.dataTransfer.files[0]);
            }
        });
        
        // 点击拖拽区域也能选择文件
        this.fileDropZone.addEventListener('click', (e) => {
            if (e.target === this.fileDropZone || e.target.tagName === 'P' || e.target.classList.contains('material-symbols-rounded')) {
                this.fallbackFileInput.click();
            }
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
     * 显示文件选择器
     * @param {string} accept - 接受的文件类型
     * @returns {Promise<File|null>} - 选择的文件
     */
    showFilePicker(accept = '*') {
        return new Promise((resolve, reject) => {
            // 检查是否支持文件API或者是否为类Unix系统
            if (!DialogManager.supportsFileAPI() && this.isUnixLike()) {
                // 使用内置文件浏览器
                if (window.FileBrowser) {
                    window.FileBrowser.show(accept)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new Error('文件浏览器未初始化'));
                }
                return;
            }
            
            this.fallbackFileInput.accept = accept;
            this.selectedFile = null;
            
            // 重置UI状态
            this.selectedFileInfo.style.display = 'none';
            this.filePickerOk.disabled = true;
            this.fallbackFileInput.value = '';
            
            // 移除之前的事件监听器
            const newFilePickerOk = this.filePickerOk.cloneNode(true);
            this.filePickerOk.parentNode.replaceChild(newFilePickerOk, this.filePickerOk);
            this.filePickerOk = newFilePickerOk;
            
            // 添加新的事件监听器
            this.filePickerOk.addEventListener('click', () => {
                this.filePickerDialog.close();
                resolve(this.selectedFile);
            });
            
            // 处理对话框关闭事件
            const handleClose = () => {
                this.filePickerDialog.removeEventListener('close', handleClose);
                resolve(null);
            };
            
            this.filePickerDialog.addEventListener('close', handleClose);
            this.filePickerDialog.showModal();
        });
    }
    
    /**
     * 处理文件选择
     * @param {File} file - 选择的文件
     */
    handleFileSelected(file) {
        this.selectedFile = file;
        this.selectedFileName.textContent = file.name;
        this.selectedFileInfo.style.display = 'flex';
        this.filePickerOk.disabled = false;
    }
    
    /**
     * 检查浏览器是否支持原生文件选择
     * @returns {boolean}
     */
    static supportsFileAPI() {
        return window.File && window.FileReader && window.FileList && window.Blob;
    }
    
    /**
     * 检查是否为类Unix系统
     * @returns {boolean}
     */
    isUnixLike() {
        const platform = navigator.platform.toLowerCase();
        const userAgent = navigator.userAgent.toLowerCase();
        
        return platform.includes('linux') || 
               platform.includes('unix') || 
               platform.includes('mac') || 
               userAgent.includes('android') ||
               userAgent.includes('iphone') ||
               userAgent.includes('ipad');
    }
    
    /**
     * 选择文件的通用方法
     * @param {string} accept - 接受的文件类型
     * @returns {Promise<File|null>}
     */
    async selectFile(accept = '*') {
        if (DialogManager.supportsFileAPI()) {
            // 优先使用原生文件选择
            try {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = accept;
                
                return new Promise((resolve) => {
                    let resolved = false;
                    
                    input.addEventListener('change', (e) => {
                        if (!resolved) {
                            resolved = true;
                            resolve(e.target.files[0] || null);
                        }
                    });
                    
                    // 监听窗口焦点事件来检测用户是否取消了文件选择
                    const handleFocus = () => {
                        setTimeout(() => {
                            if (!resolved && (!input.files || input.files.length === 0)) {
                                resolved = true;
                                resolve(null);
                            }
                            window.removeEventListener('focus', handleFocus);
                        }, 300);
                    };
                    
                    window.addEventListener('focus', handleFocus);
                    input.click();
                });
            } catch (error) {
                console.warn('Native file picker failed, falling back to custom picker:', error);
                return this.showFilePicker(accept);
            }
        } else {
            // 回退到自定义文件选择器
            return this.showFilePicker(accept);
        }
    }
}

// 创建全局实例
window.DialogManager = new DialogManager();