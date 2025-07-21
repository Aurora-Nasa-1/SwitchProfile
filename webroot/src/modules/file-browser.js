import { Core } from '../core.js';
class FileBrowser {
    constructor() {
        this.currentPath = '/sdcard';
        this.selectedFile = null;
        this.dialog = null;
        this.fileList = null;
        this.pathDisplay = null;
        this.backButton = null;
        this.selectButton = null;
        this.cancelButton = null;
        
        this.fileIcons = {
            'folder': 'folder',
            'zip': 'archive',
            'img': 'image',
            'iso': 'album',
            'apk': 'android',
            'txt': 'description',
            'log': 'article',
            'sh': 'terminal',
            'json': 'code',
            'xml': 'code',
            'default': 'description'
        };
        
        this.createDialog();
        this.setupEventListeners();
    }
    
    createDialog() {
        // 创建文件浏览器对话框
        this.dialog = document.createElement('dialog');
        this.dialog.id = 'file-browser-dialog';
        this.dialog.innerHTML = `
            <div class="file-browser-header">
                <h2>选择文件</h2>
                <div class="file-browser-toolbar">
                    <button type="button" id="file-browser-back" class="icon-button" disabled>
                        <span class="material-symbols-rounded">arrow_back</span>
                    </button>
                    <div class="file-browser-path" id="file-browser-path">/sdcard</div>
                    <button type="button" id="file-browser-refresh" class="icon-button">
                        <span class="material-symbols-rounded">refresh</span>
                    </button>
                </div>
            </div>
            <div class="file-browser-content">
                <div class="file-browser-loading" id="file-browser-loading" style="display: none;">
                    <span class="material-symbols-rounded spinning">progress_activity</span>
                    <p>加载中...</p>
                </div>
                <div class="file-browser-error" id="file-browser-error" style="display: none;">
                    <span class="material-symbols-rounded">error</span>
                    <p id="file-browser-error-message">加载失败</p>
                    <button type="button" id="file-browser-retry" class="tonal">重试</button>
                </div>
                <div class="file-list" id="file-list">
                    <!-- 文件列表将在这里动态生成 -->
                </div>
            </div>
            <fieldset>
                <button type="button" id="file-browser-cancel">取消</button>
                <button type="button" id="file-browser-select" class="filled" disabled>选择</button>
            </fieldset>
        `;
        
        document.body.appendChild(this.dialog);
        
        // 获取元素引用
        this.fileList = this.dialog.querySelector('#file-list');
        this.pathDisplay = this.dialog.querySelector('#file-browser-path');
        this.backButton = this.dialog.querySelector('#file-browser-back');
        this.selectButton = this.dialog.querySelector('#file-browser-select');
        this.cancelButton = this.dialog.querySelector('#file-browser-cancel');
        this.refreshButton = this.dialog.querySelector('#file-browser-refresh');
        this.loadingElement = this.dialog.querySelector('#file-browser-loading');
        this.errorElement = this.dialog.querySelector('#file-browser-error');
        this.errorMessage = this.dialog.querySelector('#file-browser-error-message');
        this.retryButton = this.dialog.querySelector('#file-browser-retry');
    }
    
    setupEventListeners() {
        // 取消按钮
        this.cancelButton.addEventListener('click', () => {
            this.dialog.close();
        });
        
        // 选择按钮
        this.selectButton.addEventListener('click', () => {
            if (this.selectedFile) {
                this.dialog.close();
                if (this.onFileSelected) {
                    this.onFileSelected(this.selectedFile);
                }
            }
        });
        
        // 返回按钮
        this.backButton.addEventListener('click', () => {
            this.navigateUp();
        });
        
        // 刷新按钮
        this.refreshButton.addEventListener('click', () => {
            this.loadDirectory(this.currentPath);
        });
        
        // 重试按钮
        this.retryButton.addEventListener('click', () => {
            this.loadDirectory(this.currentPath);
        });
        
        // 文件列表点击事件（事件委托）
        this.fileList.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (!fileItem) return;
            
            const filePath = fileItem.dataset.path;
            const isDirectory = fileItem.dataset.type === 'directory';
            
            if (isDirectory) {
                this.navigateToDirectory(filePath);
            } else {
                this.selectFile(fileItem);
            }
        });
        
        // 双击进入目录或选择文件
        this.fileList.addEventListener('dblclick', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (!fileItem) return;
            
            const filePath = fileItem.dataset.path;
            const isDirectory = fileItem.dataset.type === 'directory';
            
            if (isDirectory) {
                this.navigateToDirectory(filePath);
            } else {
                this.selectFile(fileItem);
                if (this.selectedFile) {
                    this.dialog.close();
                    if (this.onFileSelected) {
                        this.onFileSelected(this.selectedFile);
                    }
                }
            }
        });
    }
    
    /**
     * 显示文件浏览器
     * @param {string} accept - 接受的文件类型
     * @param {string} startPath - 起始路径
     * @returns {Promise<string|null>} - 选择的文件路径
     */
    show(accept = '*', startPath = '/sdcard') {
        return new Promise((resolve) => {
            this.currentPath = startPath;
            this.selectedFile = null;
            this.acceptTypes = this.parseAcceptTypes(accept);
            
            this.onFileSelected = (filePath) => {
                resolve(filePath);
            };
            
            // 处理对话框关闭事件
            const handleClose = () => {
                this.dialog.removeEventListener('close', handleClose);
                resolve(null);
            };
            
            this.dialog.addEventListener('close', handleClose);
            
            // 加载初始目录
            this.loadDirectory(this.currentPath);
            this.dialog.showModal();
        });
    }
    
    parseAcceptTypes(accept) {
        if (accept === '*') return [];
        
        return accept.split(',').map(type => {
            type = type.trim();
            if (type.startsWith('.')) {
                return type.substring(1).toLowerCase();
            }
            return type.toLowerCase();
        });
    }
    
    shouldShowFile(fileName, isDirectory) {
        if (isDirectory) return true;
        if (this.acceptTypes.length === 0) return true;
        
        const extension = fileName.split('.').pop().toLowerCase();
        return this.acceptTypes.includes(extension);
    }
    
    async loadDirectory(path) {
        this.showLoading();
        
        try {
            const files = await this.listDirectory(path);
            this.renderFileList(files);
            this.currentPath = path;
            this.updatePathDisplay();
            this.updateBackButton();
            this.hideLoading();
        } catch (error) {
            console.error('Failed to load directory:', error);
            this.showError(error.message || '无法加载目录');
        }
    }
    
    async listDirectory(path) {
        return new Promise((resolve, reject) => {
            // 检查ksu是否可用
            if (typeof ksu === 'undefined' || !ksu.exec) {
                reject(new Error('Shell功能不可用，请确保在支持的环境中运行'));
                return;
            }
            
            const command = `ls -F "${path}" 2>/dev/null`;
            
            Core.execCommand(command, (output) => {
                try {
                    // 确保output是字符串类型
                    const outputStr = String(output || '');
                    
                    if (outputStr.includes('Error: ksu.exec is not defined')) {
                        reject(new Error('Shell功能不可用，请确保在支持的环境中运行'));
                        return;
                    }
                    
                    if (outputStr.includes('Permission denied') || outputStr.includes('No such file')) {
                        reject(new Error('无法访问目录：权限不足或目录不存在'));
                        return;
                    }
                    
                    const files = this.parseDirectoryListing(outputStr, path);
                    resolve(files);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
    
    parseDirectoryListing(output, basePath) {
        const lines = output.trim().split('\n').filter(line => line.trim());
        const files = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // ls -F 在文件名后添加类型标识符：
            // / 表示目录
            // * 表示可执行文件
            // @ 表示符号链接
            // | 表示FIFO
            // = 表示socket
            // 普通文件没有后缀
            
            let name = trimmedLine;
            let type = 'file';
            let isSymlink = false;
            
            // 检查文件类型标识符
            if (name.endsWith('/')) {
                type = 'directory';
                name = name.slice(0, -1);
            } else if (name.endsWith('*')) {
                type = 'executable';
                name = name.slice(0, -1);
            } else if (name.endsWith('@')) {
                isSymlink = true;
                name = name.slice(0, -1);
            } else if (name.endsWith('|')) {
                type = 'fifo';
                name = name.slice(0, -1);
            } else if (name.endsWith('=')) {
                type = 'socket';
                name = name.slice(0, -1);
            }
            
            // 跳过 . 和 .. 目录
            if (name === '.' || name === '..') continue;
            
            // 过滤文件类型
            if (!this.shouldShowFile(name, type === 'directory')) continue;
            
            const filePath = basePath.endsWith('/') ? basePath + name : basePath + '/' + name;
            
            files.push({
                name,
                path: filePath,
                type,
                size: type === 'directory' ? '-' : '未知',
                permissions: '-',
                modified: '-',
                isSymlink
            });
        }
        
        // 排序：目录在前，然后按名称排序
        files.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        return files;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
    }
    
    getFileIcon(fileName, fileType, isSymlink) {
        if (isSymlink) return 'link';
        
        // 根据文件类型返回图标
        switch (fileType) {
            case 'directory':
                return this.fileIcons.folder;
            case 'executable':
                return 'terminal';
            case 'fifo':
                return 'swap_vert';
            case 'socket':
                return 'electrical_services';
            case 'file':
            default:
                // 对于普通文件，根据扩展名返回图标
                const extension = fileName.split('.').pop().toLowerCase();
                return this.fileIcons[extension] || this.fileIcons.default;
        }
    }
    
    renderFileList(files) {
        this.fileList.innerHTML = '';
        
        if (files.length === 0) {
            this.fileList.innerHTML = `
                <div class="file-browser-empty">
                    <span class="material-symbols-rounded">folder_open</span>
                    <p>此目录为空</p>
                </div>
            `;
            return;
        }
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.path = file.path;
            fileItem.dataset.type = file.type;
            fileItem.dataset.name = file.name;
            
            const icon = this.getFileIcon(file.name, file.type, file.isSymlink);
            
            fileItem.innerHTML = `
                <div class="file-icon">
                    <span class="material-symbols-rounded">${icon}</span>
                </div>
                <div class="file-info">
                    <div class="file-name">${this.escapeHtml(file.name)}</div>
                    <div class="file-details">
                        <span class="file-size">${file.size}</span>
                        <span class="file-modified">${file.modified}</span>
                    </div>
                </div>
                <div class="file-permissions">${file.permissions}</div>
            `;
            
            this.fileList.appendChild(fileItem);
        });
    }
    
    selectFile(fileItem) {
        // 移除之前的选择
        this.fileList.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 选择当前文件
        fileItem.classList.add('selected');
        this.selectedFile = fileItem.dataset.path;
        this.selectButton.disabled = false;
    }
    
    navigateToDirectory(path) {
        this.loadDirectory(path);
    }
    
    navigateUp() {
        if (this.currentPath === '/') return;
        
        const parentPath = this.currentPath.split('/').slice(0, -1).join('/') || '/';
        this.loadDirectory(parentPath);
    }
    
    updatePathDisplay() {
        this.pathDisplay.textContent = this.currentPath;
    }
    
    updateBackButton() {
        this.backButton.disabled = this.currentPath === '/';
    }
    
    showLoading() {
        this.loadingElement.style.display = 'flex';
        this.errorElement.style.display = 'none';
        this.fileList.style.display = 'none';
    }
    
    hideLoading() {
        this.loadingElement.style.display = 'none';
        this.fileList.style.display = 'block';
    }
    
    showError(message) {
        this.loadingElement.style.display = 'none';
        this.fileList.style.display = 'none';
        this.errorElement.style.display = 'flex';
        this.errorMessage.textContent = message;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 创建全局实例
window.FileBrowser = new FileBrowser();

export default FileBrowser;