class FileBrowser {
    constructor() {
        this.currentPath = '/sdcard';
        this.selectedFile = null;
        this.acceptedTypes = '*';
        this.dialog = null;
        this.fileList = null;
        this.pathDisplay = null;
        this.backButton = null;
        this.confirmButton = null;
        this.cancelButton = null;
        
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
                <div class="file-browser-path">
                    <button type="button" id="file-browser-back" class="icon-button" disabled>
                        <span class="material-symbols-rounded">arrow_back</span>
                    </button>
                    <span id="file-browser-current-path">/sdcard</span>
                </div>
            </div>
            
            <div class="file-browser-content">
                <div id="file-browser-loading" class="file-browser-loading" style="display: none;">
                    <span class="material-symbols-rounded spinning">refresh</span>
                    <p>加载中...</p>
                </div>
                <div id="file-browser-list" class="file-browser-list">
                    <!-- 文件列表将在这里动态生成 -->
                </div>
            </div>
            
            <fieldset>
                <button type="button" id="file-browser-cancel">取消</button>
                <button type="button" id="file-browser-confirm" class="filled" disabled>确定</button>
            </fieldset>
        `;
        
        document.body.appendChild(this.dialog);
        
        // 获取元素引用
        this.fileList = this.dialog.querySelector('#file-browser-list');
        this.pathDisplay = this.dialog.querySelector('#file-browser-current-path');
        this.backButton = this.dialog.querySelector('#file-browser-back');
        this.confirmButton = this.dialog.querySelector('#file-browser-confirm');
        this.cancelButton = this.dialog.querySelector('#file-browser-cancel');
        this.loadingIndicator = this.dialog.querySelector('#file-browser-loading');
    }
    
    setupEventListeners() {
        // 返回上级目录
        this.backButton.addEventListener('click', () => {
            this.navigateUp();
        });
        
        // 取消按钮
        this.cancelButton.addEventListener('click', () => {
            this.dialog.close();
        });
        
        // 确定按钮
        this.confirmButton.addEventListener('click', () => {
            if (this.selectedFile) {
                this.dialog.close();
                if (this.onFileSelected) {
                    this.onFileSelected(this.selectedFile);
                }
            }
        });
    }
    
    /**
     * 显示文件浏览器
     * @param {string} acceptedTypes - 接受的文件类型，如 '.zip,.img'
     * @returns {Promise<string|null>} - 选择的文件路径
     */
    showFileBrowser(acceptedTypes = '*') {
        return new Promise((resolve) => {
            this.acceptedTypes = acceptedTypes;
            this.selectedFile = null;
            this.confirmButton.disabled = true;
            
            this.onFileSelected = (filePath) => {
                resolve(filePath);
            };
            
            // 处理对话框关闭事件
            const handleClose = () => {
                this.dialog.removeEventListener('close', handleClose);
                resolve(null);
            };
            
            this.dialog.addEventListener('close', handleClose);
            this.loadDirectory(this.currentPath);
            this.dialog.showModal();
        });
    }
    
    /**
     * 加载目录内容
     * @param {string} path - 目录路径
     */
    async loadDirectory(path) {
        this.showLoading(true);
        
        try {
            const items = await this.getDirectoryContents(path);
            this.currentPath = path;
            this.pathDisplay.textContent = path;
            this.backButton.disabled = path === '/' || path === '/sdcard';
            
            this.renderFileList(items);
        } catch (error) {
            console.error('Failed to load directory:', error);
            Core.showToast('加载目录失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * 获取目录内容
     * @param {string} path - 目录路径
     * @returns {Promise<Array>} - 文件和目录列表
     */
    getDirectoryContents(path) {
        return new Promise((resolve, reject) => {
            // 使用find命令获取目录内容，只显示直接子项
            const command = `find "${path}" -maxdepth 1 -type f -o -type d | grep -v "^${path}$" | sort`;
            
            Core.execCommand(command, (output) => {
                if (output.includes('ERROR') || output.includes('Permission denied')) {
                    reject(new Error('无法访问目录'));
                    return;
                }
                
                const lines = output.trim().split('\n').filter(line => line.trim());
                const items = [];
                
                lines.forEach(line => {
                    const fullPath = line.trim();
                    if (!fullPath) return;
                    
                    const name = fullPath.split('/').pop();
                    if (name.startsWith('.')) return; // 跳过隐藏文件
                    
                    // 检查是否为目录
                    Core.execCommand(`test -d "${fullPath}" && echo "dir" || echo "file"`, (typeOutput) => {
                        const isDirectory = typeOutput.trim() === 'dir';
                        
                        items.push({
                            name: name,
                            path: fullPath,
                            isDirectory: isDirectory,
                            extension: isDirectory ? null : this.getFileExtension(name)
                        });
                        
                        // 当所有项目都处理完成后解析
                        if (items.length === lines.length) {
                            // 排序：目录在前，文件在后
                            items.sort((a, b) => {
                                if (a.isDirectory && !b.isDirectory) return -1;
                                if (!a.isDirectory && b.isDirectory) return 1;
                                return a.name.localeCompare(b.name);
                            });
                            resolve(items);
                        }
                    });
                });
                
                if (lines.length === 0) {
                    resolve([]);
                }
            });
        });
    }
    
    /**
     * 渲染文件列表
     * @param {Array} items - 文件和目录列表
     */
    renderFileList(items) {
        this.fileList.innerHTML = '';
        
        if (items.length === 0) {
            this.fileList.innerHTML = `
                <div class="file-browser-empty">
                    <span class="material-symbols-rounded">folder_open</span>
                    <p>此目录为空</p>
                </div>
            `;
            return;
        }
        
        items.forEach(item => {
            const itemElement = this.createFileItem(item);
            this.fileList.appendChild(itemElement);
        });
    }
    
    /**
     * 创建文件项元素
     * @param {Object} item - 文件或目录信息
     * @returns {HTMLElement} - 文件项元素
     */
    createFileItem(item) {
        const itemElement = document.createElement('div');
        itemElement.className = 'file-browser-item';
        itemElement.dataset.path = item.path;
        itemElement.dataset.isDirectory = item.isDirectory;
        
        const icon = this.getFileIcon(item);
        const isSelectable = item.isDirectory || this.isFileAccepted(item.name);
        
        itemElement.innerHTML = `
            <span class="material-symbols-rounded file-icon">${icon}</span>
            <span class="file-name">${item.name}</span>
            ${item.isDirectory ? '<span class="material-symbols-rounded">chevron_right</span>' : ''}
        `;
        
        if (!isSelectable && !item.isDirectory) {
            itemElement.classList.add('disabled');
        }
        
        // 添加点击事件
        itemElement.addEventListener('click', () => {
            if (item.isDirectory) {
                this.loadDirectory(item.path);
            } else if (isSelectable) {
                this.selectFile(item.path, itemElement);
            }
        });
        
        return itemElement;
    }
    
    /**
     * 获取文件图标
     * @param {Object} item - 文件或目录信息
     * @returns {string} - Material Icons 图标名称
     */
    getFileIcon(item) {
        if (item.isDirectory) {
            return 'folder';
        }
        
        const ext = item.extension?.toLowerCase();
        
        // 根据文件扩展名返回对应图标
        const iconMap = {
            // 压缩文件
            'zip': 'folder_zip',
            'rar': 'folder_zip',
            '7z': 'folder_zip',
            'tar': 'folder_zip',
            'gz': 'folder_zip',
            
            // 镜像文件
            'img': 'storage',
            'iso': 'storage',
            'bin': 'storage',
            
            // 文本文件
            'txt': 'description',
            'log': 'description',
            'md': 'description',
            
            // 脚本文件
            'sh': 'terminal',
            'bat': 'terminal',
            'cmd': 'terminal',
            
            // 配置文件
            'conf': 'settings',
            'cfg': 'settings',
            'ini': 'settings',
            'json': 'settings',
            'xml': 'settings',
            
            // 媒体文件
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'mp4': 'movie',
            'avi': 'movie',
            'mp3': 'music_note',
            'wav': 'music_note',
            
            // APK文件
            'apk': 'android'
        };
        
        return iconMap[ext] || 'description';
    }
    
    /**
     * 获取文件扩展名
     * @param {string} filename - 文件名
     * @returns {string|null} - 文件扩展名
     */
    getFileExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.substring(lastDot + 1) : null;
    }
    
    /**
     * 检查文件是否被接受
     * @param {string} filename - 文件名
     * @returns {boolean} - 是否被接受
     */
    isFileAccepted(filename) {
        if (this.acceptedTypes === '*') {
            return true;
        }
        
        const acceptedList = this.acceptedTypes.split(',').map(type => type.trim().toLowerCase());
        const fileExt = this.getFileExtension(filename)?.toLowerCase();
        
        return acceptedList.some(accepted => {
            if (accepted.startsWith('.')) {
                return accepted === '.' + fileExt;
            }
            return accepted === fileExt;
        });
    }
    
    /**
     * 选择文件
     * @param {string} filePath - 文件路径
     * @param {HTMLElement} itemElement - 文件项元素
     */
    selectFile(filePath, itemElement) {
        // 移除之前的选择
        this.fileList.querySelectorAll('.file-browser-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 选择当前文件
        itemElement.classList.add('selected');
        this.selectedFile = filePath;
        this.confirmButton.disabled = false;
    }
    
    /**
     * 导航到上级目录
     */
    navigateUp() {
        if (this.currentPath === '/' || this.currentPath === '/sdcard') {
            return;
        }
        
        const parentPath = this.currentPath.substring(0, this.currentPath.lastIndexOf('/')) || '/';
        this.loadDirectory(parentPath);
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

// 创建全局实例
window.FileBrowser = new FileBrowser();