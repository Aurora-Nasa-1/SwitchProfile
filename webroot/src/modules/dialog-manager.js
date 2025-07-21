class DialogManager {
    constructor() {
        this.confirmDialog = document.getElementById('confirm-dialog');
        this.confirmTitle = document.getElementById('confirm-title');
        this.confirmContent = document.getElementById('confirm-content');
        this.confirmCancel = document.getElementById('confirm-cancel');
        this.confirmOk = document.getElementById('confirm-ok');
        
        this.fileBrowserDialog = document.getElementById('file-browser-dialog');
        this.backButton = document.getElementById('back-button');
        this.currentPathElement = document.getElementById('current-path');
        this.fileList = document.getElementById('file-list');
        this.fileBrowserCancel = document.getElementById('file-browser-cancel');
        this.fileBrowserOk = document.getElementById('file-browser-ok');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 确认对话框事件
        this.confirmCancel.addEventListener('click', () => {
            this.confirmDialog.close();
        });
        
        // 文件浏览器事件
        this.fileBrowserCancel.addEventListener('click', () => {
            this.fileBrowserDialog.close();
        });

        this.backButton.addEventListener('click', () => {
            this.navigateUp();
        });

        this.fileBrowserOk.addEventListener('click', () => {
            if (this.selectedFile) {
                this.fileBrowserDialog.close();
                // 这里需要处理选中的文件路径
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
     * 显示文件浏览器
     * @param {string} accept - 接受的文件类型
     * @returns {Promise<string|null>} - 选择的文件的路径
     */
    showFileBrowser(accept = '*') {
        return new Promise((resolve) => {
            this.currentPath = '/sdcard/';
            this.selectedFile = null;
            this.accept = accept;

            // 重置UI
            this.fileBrowserOk.disabled = true;
            this.loadDirectory(this.currentPath);

            // 处理确认按钮
            const handleOk = () => {
                this.fileBrowserDialog.close();
                resolve(this.selectedFile);
            };

            this.fileBrowserOk.addEventListener('click', handleOk);

            // 处理关闭
            const handleClose = () => {
                this.fileBrowserDialog.removeEventListener('close', handleClose);
                this.fileBrowserOk.removeEventListener('click', handleOk);
                resolve(null);
            };

            this.fileBrowserDialog.addEventListener('close', handleClose);
            this.fileBrowserDialog.showModal();
        });
    }

    /**
     * 加载目录内容
     * @param {string} path - 目录路径
     */
    loadDirectory(path) {
        this.currentPath = path;
        this.currentPathElement.textContent = path;
        this.backButton.disabled = path === '/';

        Core.execCommand(`ls -F "${path}"`, (output) => {
            if (output.includes('ERROR')) {
                console.error('Failed to list directory:', output);
                this.fileList.innerHTML = '<p class="error">无法加载目录</p>';
                return;
            }

            const items = output.trim().split('\n').filter(item => item);
            this.renderFileList(items);
        });
    }

    /**
     * 渲染文件列表
     * @param {string[]} items - 文件/目录列表
     */
    renderFileList(items) {
        this.fileList.innerHTML = '';
        items.forEach(item => {
            const isDirectory = item.endsWith('/');
            const name = item.replace(/[@*\/=|$]+$/, '');
            const icon = isDirectory ? 'folder' : this.getFileIcon(name);

            const div = document.createElement('div');
            div.className = 'file-item' + (isDirectory ? ' directory' : '');
            div.innerHTML = `
                <span class="material-symbols-rounded">${icon}</span>
                <span class="file-name">${name}</span>
            `;

            div.addEventListener('click', () => {
                if (isDirectory) {
                    this.loadDirectory(this.currentPath + (this.currentPath.endsWith('/') ? '' : '/') + name);
                } else {
                    this.selectedFile = this.currentPath + (this.currentPath.endsWith('/') ? '' : '/') + name;
                    this.fileBrowserOk.disabled = false;
                    // 高亮选中项
                    document.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                }
            });

            this.fileList.appendChild(div);
        });
    }

    /**
     * 获取文件图标
     * @param {string} name - 文件名
     * @returns {string} - 图标名称
     */
    getFileIcon(name) {
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
            zip: 'archive',
            img: 'image',
            txt: 'description',
            pdf: 'picture_as_pdf',
            mp3: 'audio_file',
            mp4: 'video_file',
            default: 'insert_drive_file'
        };
        return icons[ext] || icons.default;
    }

    /**
     * 导航到上级目录
     */
    navigateUp() {
        if (this.currentPath !== '/') {
            const parts = this.currentPath.split('/').filter(p => p);
            parts.pop();
            this.loadDirectory('/' + parts.join('/') + (parts.length ? '/' : ''));
        }
    }

    /**
     * 选择文件的通用方法
     * @param {string} accept - 接受的文件类型
     * @returns {Promise<string|null>} - 文件路径
     */
    async selectFile(accept = '*') {
        return this.showFileBrowser(accept);
    }
}

// 创建全局实例
window.DialogManager = new DialogManager();