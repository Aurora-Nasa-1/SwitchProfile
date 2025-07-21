import { Core } from '../core.js';

export class FileManager {
    constructor() {
        this.targetDirectory = `${Core.MODULE_PATH}files/`;
        this.ensureDirectoryExists();
    }
    
    ensureDirectoryExists() {
        // 确保目标目录存在
        Core.execCommand(`mkdir -p "${this.targetDirectory}"`, (output) => {
            if (output.includes('ERROR')) {
                console.error('Failed to create target directory:', output);
            }
        });
    }
    
    /**
     * 复制文件到模块目录
     * @param {File} file - 要复制的文件对象
     * @returns {Promise<string>} - 返回复制后的文件路径
     */
    async copyFile(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const content = e.target.result;
                    const fileName = this.generateFileName(file.name);
                    const targetPath = `${this.targetDirectory}${fileName}`;
                    
                    // 将文件内容写入目标路径
                    this.writeFileContent(targetPath, content)
                        .then(() => resolve(targetPath))
                        .catch(reject);
                };
                
                reader.onerror = () => {
                    reject(new Error('Failed to read file'));
                };
                
                // 根据文件类型选择读取方式
                if (this.isBinaryFile(file.name)) {
                    reader.readAsArrayBuffer(file);
                } else {
                    reader.readAsText(file);
                }
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 生成唯一的文件名
     * @param {string} originalName - 原始文件名
     * @returns {string} - 生成的文件名
     */
    generateFileName(originalName) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        const extension = originalName.split('.').pop();
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        
        return `${baseName}_${timestamp}_${random}.${extension}`;
    }
    
    /**
     * 判断是否为二进制文件
     * @param {string} fileName - 文件名
     * @returns {boolean} - 是否为二进制文件
     */
    isBinaryFile(fileName) {
        const binaryExtensions = ['.zip', '.img', '.bin', '.so', '.apk', '.jar'];
        const extension = '.' + fileName.split('.').pop().toLowerCase();
        return binaryExtensions.includes(extension);
    }
    
    /**
     * 写入文件内容
     * @param {string} targetPath - 目标路径
     * @param {string|ArrayBuffer} content - 文件内容
     * @returns {Promise<void>}
     */
    async writeFileContent(targetPath, content) {
        return new Promise((resolve, reject) => {
            try {
                if (content instanceof ArrayBuffer) {
                    // 处理二进制文件
                    this.writeBinaryFile(targetPath, content)
                        .then(resolve)
                        .catch(reject);
                } else {
                    // 处理文本文件
                    this.writeTextFile(targetPath, content)
                        .then(resolve)
                        .catch(reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 写入文本文件
     * @param {string} targetPath - 目标路径
     * @param {string} content - 文本内容
     * @returns {Promise<void>}
     */
    async writeTextFile(targetPath, content) {
        return new Promise((resolve, reject) => {
            // 转义特殊字符
            const escapedContent = content.replace(/'/g, "'\"'\"'");
            
            Core.execCommand(`echo '${escapedContent}' > "${targetPath}"`, (output) => {
                if (output.includes('ERROR') || output.includes('Permission denied')) {
                    reject(new Error(`Failed to write file: ${output}`));
                } else {
                    resolve();
                }
            });
        });
    }
    
    /**
     * 写入二进制文件
     * @param {string} targetPath - 目标路径
     * @param {ArrayBuffer} content - 二进制内容
     * @returns {Promise<void>}
     */
    async writeBinaryFile(targetPath, content) {
        return new Promise((resolve, reject) => {
            try {
                // 将ArrayBuffer转换为base64
                const uint8Array = new Uint8Array(content);
                const base64 = this.arrayBufferToBase64(uint8Array);
                
                // 使用base64解码写入文件
                Core.execCommand(`echo '${base64}' | base64 -d > "${targetPath}"`, (output) => {
                    if (output.includes('ERROR') || output.includes('Permission denied')) {
                        reject(new Error(`Failed to write binary file: ${output}`));
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 将ArrayBuffer转换为base64字符串
     * @param {Uint8Array} buffer - 字节数组
     * @returns {string} - base64字符串
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        return btoa(binary);
    }
    
    /**
     * 删除文件
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>} - 删除是否成功
     */
    async deleteFile(filePath) {
        return new Promise((resolve) => {
            Core.execCommand(`rm -f "${filePath}"`, (output) => {
                if (output.includes('ERROR')) {
                    console.error('Failed to delete file:', output);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }
    
    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>} - 文件是否存在
     */
    async fileExists(filePath) {
        return new Promise((resolve) => {
            Core.execCommand(`test -f "${filePath}" && echo "exists" || echo "not found"`, (output) => {
                resolve(output.trim() === 'exists');
            });
        });
    }
    
    /**
     * 获取文件大小
     * @param {string} filePath - 文件路径
     * @returns {Promise<number>} - 文件大小（字节）
     */
    async getFileSize(filePath) {
        return new Promise((resolve) => {
            Core.execCommand(`stat -c%s "${filePath}" 2>/dev/null || echo "0"`, (output) => {
                const size = parseInt(output.trim()) || 0;
                resolve(size);
            });
        });
    }
    
    /**
     * 列出目录中的文件
     * @param {string} directory - 目录路径
     * @returns {Promise<string[]>} - 文件列表
     */
    async listFiles(directory = this.targetDirectory) {
        return new Promise((resolve) => {
            Core.execCommand(`ls -1 "${directory}" 2>/dev/null || echo ""`, (output) => {
                if (output.trim()) {
                    const files = output.trim().split('\n').filter(file => file.trim());
                    resolve(files);
                } else {
                    resolve([]);
                }
            });
        });
    }
    
    /**
     * 清理过期文件（超过7天的文件）
     * @returns {Promise<number>} - 清理的文件数量
     */
    async cleanupOldFiles() {
        return new Promise((resolve) => {
            Core.execCommand(`find "${this.targetDirectory}" -type f -mtime +7 -delete 2>/dev/null; echo $?`, (output) => {
                const exitCode = parseInt(output.trim());
                if (exitCode === 0) {
                    // 获取清理后的文件数量
                    this.listFiles().then(files => {
                        console.log(`Cleanup completed. ${files.length} files remaining.`);
                        resolve(files.length);
                    });
                } else {
                    console.error('Cleanup failed');
                    resolve(0);
                }
            });
        });
    }
    
    /**
     * 获取目录使用的磁盘空间
     * @returns {Promise<string>} - 磁盘使用情况
     */
    async getDiskUsage() {
        return new Promise((resolve) => {
            Core.execCommand(`du -sh "${this.targetDirectory}" 2>/dev/null || echo "0B"`, (output) => {
                const usage = output.trim().split('\t')[0] || '0B';
                resolve(usage);
            });
        });
    }
    
    /**
     * 验证文件完整性（检查文件是否可读）
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>} - 文件是否完整
     */
    async validateFile(filePath) {
        return new Promise((resolve) => {
            Core.execCommand(`test -r "${filePath}" && echo "valid" || echo "invalid"`, (output) => {
                resolve(output.trim() === 'valid');
            });
        });
    }
}