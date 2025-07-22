export class SettingsManager {
    constructor() {
        this.settings = {
            noConfirm: false,
            hue: 300,
            exportPath: '/data/adb/switchprofile/export/'
        };
        this.loadSettings();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('switchprofile-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('switchprofile-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    getSetting(key) {
        return this.settings[key];
    }

    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        this.applySettings();
    }

    applySettings() {
        // 应用hue设置到CSS变量
        document.documentElement.style.setProperty('--hue', this.settings.hue);
    }

    initializeUI() {
        // 应用当前设置
        this.applySettings();
        
        // 设置UI元素的初始值
        const noConfirmCheckbox = document.getElementById('no-confirm-setting');
        const hueSlider = document.getElementById('hue-slider');
        const hueValue = document.getElementById('hue-value');
        const exportPathInput = document.getElementById('export-path-setting');
        
        if (noConfirmCheckbox) {
            noConfirmCheckbox.checked = this.settings.noConfirm;
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
        const noConfirmCheckbox = document.getElementById('no-confirm-setting');
        const hueSlider = document.getElementById('hue-slider');
        const hueValue = document.getElementById('hue-value');
        const exportPathInput = document.getElementById('export-path-setting');

        // 设置按钮点击事件
        if (settingsBtn && settingsDialog) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }

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

        // 无需确认设置变更
        if (noConfirmCheckbox) {
            noConfirmCheckbox.addEventListener('change', (e) => {
                this.setSetting('noConfirm', e.target.checked);
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