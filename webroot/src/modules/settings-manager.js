export class SettingsManager {
    constructor() {
        this.settings = {
            noConfirm: false,
            hue: 300,
            exportPath: '/sdcard/Download/',
            useNativeToast: this.isKSUEnvironment(), // 默认在KSU环境中开启原生toast
            debugMode: false, // Debug模式设置
            language: 'zh-CN' // 默认语言
        };
        this.loadSettings();
    }
    
    // 检测是否在KSU环境中
    isKSUEnvironment() {
        return typeof ksu !== "undefined" && ksu.toast;
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('switchprofile-settings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                this.settings = { ...this.settings, ...loadedSettings };
                
                if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                    window.Core.logDebug(`Settings loaded successfully: ${JSON.stringify(loadedSettings)}`, 'SETTINGS');
                    window.Core.showToast('[DEBUG] Settings loaded from localStorage', 'info');
                }
            } else {
                if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                    window.Core.logDebug('No saved settings found, using defaults', 'SETTINGS');
                    window.Core.showToast('[DEBUG] Using default settings', 'info');
                }
            }
            
            // 同步语言设置到i18n manager
            const i18nLanguage = localStorage.getItem('app_language');
            if (i18nLanguage && i18nLanguage !== this.settings.language) {
                this.settings.language = i18nLanguage;
                this.saveSettings();
            } else if (!i18nLanguage && this.settings.language) {
                localStorage.setItem('app_language', this.settings.language);
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
            if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                window.Core.logDebug(`Settings loading failed: ${error.message}`, 'ERROR');
                window.Core.showToast(`[DEBUG] Settings loading failed: ${error.message}`, 'error');
            }
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('switchprofile-settings', JSON.stringify(this.settings));
            
            if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                window.Core.logDebug(`Settings saved successfully: ${JSON.stringify(this.settings)}`, 'SETTINGS');
                window.Core.showToast('[DEBUG] Settings saved to localStorage', 'success');
            }
        } catch (error) {
            console.warn('Failed to save settings:', error);
            if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
                window.Core.logDebug(`Settings saving failed: ${error.message}`, 'ERROR');
                window.Core.showToast(`[DEBUG] Settings saving failed: ${error.message}`, 'error');
            }
        }
    }

    getSetting(key) {
        return this.settings[key];
    }

    setSetting(key, value) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
            window.Core.logDebug(`Setting updated: ${key} = ${JSON.stringify(value)} (old: ${JSON.stringify(oldValue)})`, 'SETTINGS');
            window.Core.showToast(`[DEBUG] Setting updated: ${key}`, 'info');
        }
        
        // 如果是语言设置变更，立即应用并同步到i18n manager
        if (key === 'language' && window.I18n) {
            window.I18n.setLanguage(value, true); // 传递true避免循环调用
            localStorage.setItem('app_language', value);
        }
        
        this.saveSettings();
        this.applySettings();
    }

    applySettings() {
        // 应用hue设置到CSS变量
        document.documentElement.style.setProperty('--hue', this.settings.hue);
        
        if (typeof window.Core !== 'undefined' && window.Core.isDebugMode && window.Core.isDebugMode()) {
            window.Core.logDebug(`Settings applied: hue=${this.settings.hue}`, 'SETTINGS');
        }
    }

    initializeUI() {
        // 应用当前设置
        this.applySettings();
        
        // 设置UI元素的初始值
        const languageSelect = document.getElementById('language-setting');
        const noConfirmCheckbox = document.getElementById('no-confirm-setting');
        const useNativeToastCheckbox = document.getElementById('native-toast-setting');
        const debugModeCheckbox = document.getElementById('debug-mode-setting');
        const hueSlider = document.getElementById('hue-slider');
        const hueValue = document.getElementById('hue-value');
        const exportPathInput = document.getElementById('export-path-setting');
        
        if (languageSelect) {
            languageSelect.value = this.settings.language;
        }
        
        if (noConfirmCheckbox) {
            noConfirmCheckbox.checked = this.settings.noConfirm;
        }
        
        if (useNativeToastCheckbox) {
            useNativeToastCheckbox.checked = this.settings.useNativeToast;
        }
        
        if (debugModeCheckbox) {
            debugModeCheckbox.checked = this.settings.debugMode;
        }
        
        if (hueSlider) {
            hueSlider.value = this.settings.hue;
        }
        
        if (hueValue) {
            hueValue.textContent = this.settings.hue;
        }
        
        if (exportPathInput) {
            exportPathInput.value = this.settings.exportPath;
        }
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        const settingsBtn = document.getElementById('settings-btn');
        const settingsDialog = document.getElementById('settings-dialog');
        const closeBtn = document.getElementById('close-settings');
        const languageSelect = document.getElementById('language-setting');
        const noConfirmCheckbox = document.getElementById('no-confirm-setting');
        const useNativeToastCheckbox = document.getElementById('native-toast-setting');
        const debugModeCheckbox = document.getElementById('debug-mode-setting');
        const hueSlider = document.getElementById('hue-slider');
        const hueValue = document.getElementById('hue-value');
        const exportPathInput = document.getElementById('export-path-setting');

        // 注意：设置按钮的事件监听器已在app.js中绑定，这里不再重复绑定

        // 关闭按钮点击事件
        if (closeBtn && settingsDialog) {
            closeBtn.addEventListener('click', () => {
                this.closeDialog();
            });
        }

        // 点击背景关闭对话框
        if (settingsDialog) {
            settingsDialog.addEventListener('click', (e) => {
                if (e.target === settingsDialog) {
                    this.closeDialog();
                }
            });
        }

        // 语言设置变更
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                this.setSetting('language', e.target.value);
            });
        }
        
        // 无需确认设置变更
        if (noConfirmCheckbox) {
            noConfirmCheckbox.addEventListener('change', (e) => {
                this.setSetting('noConfirm', e.target.checked);
            });
        }
        
        // 原生toast设置变更
        if (useNativeToastCheckbox) {
            useNativeToastCheckbox.addEventListener('change', (e) => {
                this.setSetting('useNativeToast', e.target.checked);
            });
        }
        
        // Debug模式设置变更
        if (debugModeCheckbox) {
            debugModeCheckbox.addEventListener('change', (e) => {
                this.setSetting('debugMode', e.target.checked);
            });
        }

        // hue滑动条变更
        if (hueSlider && hueValue) {
            hueSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                hueValue.textContent = value;
                this.setSetting('hue', value);
            });
        }
        
        // 导出路径变更
        if (exportPathInput) {
            exportPathInput.addEventListener('change', (e) => {
                this.setSetting('exportPath', e.target.value);
            });
        }
    }

    shouldSkipConfirm() {
        return this.settings.noConfirm;
    }

    openSettings() {
         const settingsDialog = document.getElementById('settings-dialog');
         if (settingsDialog) {
             settingsDialog.showModal();
             // 触发进入动画
             setTimeout(() => {
                 settingsDialog.classList.add('showing');
             }, 10);
         }
     }

     closeDialog() {
         const settingsDialog = document.getElementById('settings-dialog');
         if (settingsDialog) {
             settingsDialog.classList.remove('showing');
             settingsDialog.classList.add('closing');
             
             // 等待动画完成后关闭对话框
             setTimeout(() => {
                 settingsDialog.close();
                 settingsDialog.classList.remove('closing');
             }, 200); // 与CSS动画时间一致
         }
     }
}