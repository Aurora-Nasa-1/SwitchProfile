import { Core } from '../core.js';

class AndroidFileBrowser {
    constructor() {
        this.dialog = document.getElementById('android-file-browser');
        this.backButton = document.getElementById('file-browser-back');
        this.closeButton = document.getElementById('file-browser-close');
        this.currentPathElement = document.getElementById('current-path');
        this.fileList = document.getElementById('file-list');
        this.loadingIndicator = document.getElementById('file-browser-loading');
        this.selectedFileDisplay = document.getElementById('selected-file-display');
        this.selectedFilePath = document.getElementById('selected-file-path');
        this.cancelButton = document.getElementById('file-browser-cancel');
        this.okButton = document.getElementById('file-browser-ok');
        
        this.currentPath = '/sdcard';
        this.selectedFile = null;
        this.pathHistory = [];
        this.acceptedExtensions = [];
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.backButton.addEventListener('click', () => {
            this.navigateBack();
        });
        
        this.closeButton.addEventListener('click', () => {
            this.dialog.close();
        });
        
        this.cancelButton.addEventListener('click', () => {
            this.dialog.close();
        });
    }
    
    /**
     * 显示文件浏览器
     * @param {string} accept - 接受的文件类型
     * @returns {Promise<string|null>} - 选择的文件路径
     */
    showBrowser(accept = '*') {
        return new Promise((resolve) => {
            this.parseAcceptedTypes(accept);
            this.selectedFile = null;
            this.currentPath = '/sdcard';
            this.pathHistory = [];
            
            // 重置UI状态
            this.selectedFileDisplay.style.display = 'none';
            this.okButton.disabled = true;
            this.updateBackButton();
            
            // 移除之前的事件监听器
            const newOkButton = this.okButton.cloneNode(true);
            this.okButton.parentNode.replaceChild(newOkButton, this.okButton);
            this.okButton = newOkButton;
            
            // 添加新的事件监听器
            this.okButton.addEventListener('click', () => {
                this.dialog.close();
                resolve(this.selectedFile);
            });
            
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
    
    /**
     * 解析接受的文件类型
     * @param {string} accept - 文件类型字符串
     */
    parseAcceptedTypes(accept) {
        this.acceptedExtensions = [];
        if (accept === '*' || !accept) {
            return;
        }
        
        const types = accept.split(',').map(type => type.trim());
        for (const type of types) {
            if (type.startsWith('.')) {
                this.acceptedExtensions.push(type.toLowerCase());
            } else if (type.includes('/')) {
                // MIME类型转换为扩展名
                const mimeToExt = {
                    'application/zip': '.zip',
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
                    'text/*': ['.txt', '.log', '.conf', '.sh']
                };
                
                if (mimeToExt[type]) {
                    const exts = Array.isArray(mimeToExt[type]) ? mimeToExt[type] : [mimeToExt[type]];
                    this.acceptedExtensions.push(...exts);
                }
            }
        }
    }
    
    /**
     * 检查文件是否被接受
     * @param {string} fileName - 文件名
     * @returns {boolean}
     */
    isFileAccepted(fileName) {
        if (this.acceptedExtensions.length === 0) {
            return true;
        }
        
        const nameParts = fileName.split('.');
        if (nameParts.length <= 1) {
            return false; // 没有扩展名的文件不匹配特定类型
        }
        
        const ext = '.' + nameParts.pop().toLowerCase();
        return this.acceptedExtensions.includes(ext);
    }
    
    /**
     * 加载目录内容
     * @param {string} path - 目录路径
     */
    async loadDirectory(path) {
        this.showLoading(true);
        this.currentPath = path;
        this.currentPathElement.textContent = path;
        
        try {
            const files = await this.listFiles(path);
            this.renderFileList(files);
        } catch (error) {
            console.error('Failed to load directory:', error);
            Core.showToast('加载目录失败', 'error');
            this.renderFileList([]);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * 使用ls -F命令列出文件
     * @param {string} path - 目录路径
     * @returns {Promise<Array>} - 文件列表
     */
    listFiles(path) {
        return new Promise((resolve, reject) => {
            // 使用更简单的find命令，分别获取文件和目录
            const command = `find "${path}" -maxdepth 1 -mindepth 1 -printf "%f:%y\n" 2>/dev/null || echo "ERROR: Directory not accessible"`;
            
            Core.execCommand(command, (output) => {
                if (output && (output.includes('ERROR') || output.includes('No such file') || output.includes('Permission denied'))) {
                    reject(new Error('Directory not found or permission denied'));
                    return;
                }
                
                const files = this.parseFileListFromFind(output, path);
                resolve(files);
            });
        });
    }
    
    /**
     * 解析find命令的输出
     * @param {string} output - 命令输出
     * @param {string} basePath - 基础路径
     * @returns {Array} - 解析后的文件列表
     */
    parseFileListFromFind(output, basePath) {
        if (!output || output.trim() === '') {
            return [];
        }
        
        const lines = output.trim().split('\n').filter(line => line.trim());
        const files = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('ERROR:')) continue;
            
            // 解析find的printf输出格式：文件名:文件类型
            const colonIndex = trimmedLine.lastIndexOf(':');
            if (colonIndex === -1) continue;
            
            const name = trimmedLine.substring(0, colonIndex);
            const fileType = trimmedLine.substring(colonIndex + 1);
            
            if (!name || name === '.' || name === '..') continue;
            
            const fullPath = basePath + (basePath.endsWith('/') ? '' : '/') + name;
            const isDirectory = fileType === 'd';
            const isExecutable = fileType === 'f' && name.includes('.');
            
            let type = 'file';
            if (isDirectory) {
                type = 'directory';
            } else if (isExecutable) {
                type = 'executable';
            }
            
            files.push({
                name: name,
                type: type,
                path: fullPath,
                isDirectory: isDirectory
            });
        }
        
        // 排序：目录在前，然后按名称排序
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        return files;
    }
    
    /**
     * 解析ls -F命令的输出（保留作为备用）
     * @param {string} output - 命令输出
     * @param {string} basePath - 基础路径
     * @returns {Array} - 解析后的文件列表
     */
    parseFileList(output, basePath) {
        if (!output || output.trim() === '') {
            return [];
        }
        
        const lines = output.trim().split('\n').filter(line => line.trim());
        const files = [];
        
        for (const line of lines) {
            const name = line.trim();
            if (!name || name === '.' || name === '..' || name.startsWith('ERROR:')) continue;
            
            const isDirectory = name.endsWith('/');
            const isExecutable = name.endsWith('*');
            const isSymlink = name.endsWith('@');
            
            let cleanName = name;
            let type = 'file';
            
            if (isDirectory) {
                cleanName = name.slice(0, -1);
                type = 'directory';
            } else if (isExecutable) {
                cleanName = name.slice(0, -1);
                type = 'executable';
            } else if (isSymlink) {
                cleanName = name.slice(0, -1);
                type = 'symlink';
            }
            
            // 跳过空名称
            if (!cleanName) continue;
            
            files.push({
                name: cleanName,
                type: type,
                path: basePath + (basePath.endsWith('/') ? '' : '/') + cleanName,
                isDirectory: type === 'directory'
            });
        }
        
        // 排序：目录在前，然后按名称排序
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        return files;
    }
    
    /**
     * 渲染文件列表
     * @param {Array} files - 文件列表
     */
    renderFileList(files) {
        this.fileList.innerHTML = '';
        
        for (const file of files) {
            const fileItem = this.createFileItem(file);
            this.fileList.appendChild(fileItem);
        }
        
        if (files.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.style.cssText = 'text-align: center; padding: 2rem; color: var(--on-surface-variant);';
            emptyMessage.innerHTML = `
                <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 1rem;">folder_open</span>
                <p>此目录为空</p>
            `;
            this.fileList.appendChild(emptyMessage);
        }
    }
    
    /**
     * 创建文件项元素
     * @param {Object} file - 文件信息
     * @returns {HTMLElement} - 文件项元素
     */
    createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-item';
        if (file.isDirectory) {
            item.classList.add('directory');
        }
        
        const icon = this.getFileIcon(file);
        const isSelectable = file.isDirectory || this.isFileAccepted(file.name);
        
        if (!isSelectable && !file.isDirectory) {
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
        }
        
        item.innerHTML = `
            <span class="material-symbols-rounded file-icon">${icon}</span>
            <span class="file-name">${file.name}</span>
        `;
        
        if (isSelectable) {
            item.addEventListener('click', () => {
                if (file.isDirectory) {
                    this.navigateToDirectory(file.path);
                } else {
                    this.selectFile(file);
                }
            });
        }
        
        return item;
    }
    
    /**
     * 获取文件图标
     * @param {Object} file - 文件信息
     * @returns {string} - 图标名称
     */
    getFileIcon(file) {
        if (file.isDirectory) {
            return 'folder';
        }
        
        const nameParts = file.name.split('.');
        const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : '';
        
        const iconMap = {
            // 压缩文件
            'zip': 'archive',
            'rar': 'archive',
            '7z': 'archive',
            'tar': 'archive',
            'gz': 'archive',
            
            // 图片文件
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'bmp': 'image',
            'webp': 'image',
            
            // 文本文件
            'txt': 'description',
            'log': 'description',
            'conf': 'settings',
            'cfg': 'settings',
            'ini': 'settings',
            
            // 脚本文件
            'sh': 'terminal',
            'py': 'code',
            'js': 'code',
            
            // 系统文件
            'img': 'storage',
            'iso': 'storage',
            
            // 可执行文件
            'apk': 'android',
            'exe': 'launch'
        };
        
        return iconMap[ext] || (file.type === 'executable' ? 'play_arrow' : 'description');
    }
    
    /**
     * 导航到目录
     * @param {string} path - 目录路径
     */
    navigateToDirectory(path) {
        this.pathHistory.push(this.currentPath);
        this.loadDirectory(path);
        this.updateBackButton();
        this.clearSelection();
    }
    
    /**
     * 返回上级目录
     */
    navigateBack() {
        if (this.pathHistory.length > 0) {
            const previousPath = this.pathHistory.pop();
            this.loadDirectory(previousPath);
            this.updateBackButton();
            this.clearSelection();
        } else {
            // 如果没有历史记录，尝试返回上级目录
            const parentPath = this.getParentPath(this.currentPath);
            if (parentPath && parentPath !== this.currentPath) {
                this.loadDirectory(parentPath);
                this.updateBackButton();
                this.clearSelection();
            }
        }
    }
    
    /**
     * 获取上级目录路径
     * @param {string} path - 当前路径
     * @returns {string|null} - 上级目录路径
     */
    getParentPath(path) {
        if (path === '/' || path === '') {
            return null;
        }
        
        // 移除末尾的斜杠
        const cleanPath = path.replace(/\/+$/, '');
        
        // 找到最后一个斜杠的位置
        const lastSlashIndex = cleanPath.lastIndexOf('/');
        
        if (lastSlashIndex === 0) {
            // 如果最后一个斜杠在开头，返回根目录
            return '/';
        } else if (lastSlashIndex > 0) {
            // 返回上级目录
            return cleanPath.substring(0, lastSlashIndex);
        }
        
        return null;
    }
    
    /**
     * 更新返回按钮状态
     */
    updateBackButton() {
        const hasHistory = this.pathHistory.length > 0;
        const hasParent = this.getParentPath(this.currentPath) !== null;
        this.backButton.disabled = !hasHistory && !hasParent;
    }
    
    /**
     * 选择文件
     * @param {Object} file - 文件信息
     */
    selectFile(file) {
        // 清除之前的选择
        this.fileList.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 选择当前文件
        const fileItems = this.fileList.querySelectorAll('.file-item');
        for (const item of fileItems) {
            if (item.querySelector('.file-name').textContent === file.name) {
                item.classList.add('selected');
                break;
            }
        }
        
        this.selectedFile = file.path;
        this.selectedFilePath.textContent = file.path;
        this.selectedFileDisplay.style.display = 'flex';
        this.okButton.disabled = false;
    }
    
    /**
     * 清除选择
     */
    clearSelection() {
        this.fileList.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        this.selectedFile = null;
        this.selectedFileDisplay.style.display = 'none';
        this.okButton.disabled = true;
    }
    
    /**
     * 显示/隐藏加载指示器
     * @param {boolean} show - 是否显示
     */
    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'flex' : 'none';
        this.fileList.style.display = show ? 'none' : 'block';
    }
}

export default AndroidFileBrowser;