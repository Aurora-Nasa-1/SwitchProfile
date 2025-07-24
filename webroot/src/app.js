import { Core } from './core.js';
import { HomePage } from './modules/home.js';
import { ManagePage } from './modules/manage.js';
import { ScenarioManager } from './modules/scenario-manager.js';
import { SettingsManager } from './modules/settings-manager.js';
import './modules/dialog-manager.js';
import './modules/i18n-manager.js';

class App {
    constructor() {
        this.currentPage = 'home';
        this.scenarioManager = new ScenarioManager();
        this.settingsManager = new SettingsManager();
        
        // 设置全局变量以便Core模块访问
        window.settingsManager = this.settingsManager;
        
        // 设置Core全局变量以便其他模块访问
        window.Core = Core;
        
        this.homePage = new HomePage(this.scenarioManager, this.settingsManager);
        this.managePage = new ManagePage(this.scenarioManager, this.settingsManager);
        
        if (Core.isDebugMode()) {
            Core.logDebug('APP', 'Application constructor completed');
            Core.showToast('[DEBUG] Application starting...', 'info');
        }
        
        this.init();
    }
    
    async init() {
        if (Core.isDebugMode()) {
            Core.logDebug('APP', 'Starting application initialization');
        }
        
        try {
            // 更新加载状态
            updateLoadingIndicator('app.loading.initializing');
            
            // 并行初始化关键组件
            const initPromises = [
                // 优先初始化i18n管理器
                window.I18n ? window.I18n.init() : Promise.resolve(),
                // 并行初始化设置管理器UI（不依赖i18n）
                Promise.resolve().then(() => this.settingsManager.initializeUI())
            ];
            
            await Promise.all(initPromises);
            
            // 设置基础UI组件（不依赖数据加载）
            this.setupNavigation();
            this.setupFAB();
            
            // 监听语言变化事件
            window.addEventListener('languageChanged', () => {
                this.updateUI();
            });
            
            // 显示应用界面（在数据加载前）
            this.showApp();
            
            // 异步加载情景数据（不阻塞UI显示）
            this.loadScenarios().then(() => {
                if (Core.isDebugMode()) {
                    Core.logDebug('APP', 'Scenarios loaded and UI updated');
                }
            }).catch(error => {
                console.error('Failed to load scenarios:', error);
                if (Core.isDebugMode()) {
                    Core.showToast(`[DEBUG] Scenario loading failed: ${error.message}`, 'error');
                }
            });
            
            if (Core.isDebugMode()) {
                Core.logDebug('APP', 'Application initialization completed');
            }
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('APP', `Initialization failed: ${error.message}`);
                Core.showToast('[DEBUG] Application initialization failed', 'error');
            }
            // 即使初始化失败也要隐藏加载指示器并显示应用
            hideLoadingIndicator();
            this.showApp();
        }
    }
    
    updateUI() {
        // 更新导航文本
        if (window.I18n) {
            window.I18n.updateDOM();
        }
        
        // 重新渲染当前页面
        this.showPage(this.currentPage);
        
        if (Core.isDebugMode()) {
            Core.logDebug('APP', 'UI updated for language change');
        }
    }
    
    showPage(page) {
        this.navigateTo(page);
    }

    setupNavigation() {
        // 设置底部导航
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
        
        // 设置侧栏导航
        const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
        sidebarNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
        
        // 设置顶栏按钮
        this.setupHeaderButtons();
        
        // 设置侧栏按钮
        this.setupSidebarButtons();
    }
    
    setupFAB() {
        const fab = document.getElementById('fab');
        if (fab && !fab.hasAttribute('data-event-bound')) {
            fab.addEventListener('click', () => {
                if (this.currentPage === 'manage') {
                    this.managePage.showEditDialog();
                }
            });
            fab.setAttribute('data-event-bound', 'true');
        }
    }
    
    setupHeaderButtons() {
        // 设置按钮
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn && !settingsBtn.hasAttribute('data-event-bound')) {
            settingsBtn.addEventListener('click', () => {
                this.settingsManager.openSettings();
            });
            settingsBtn.setAttribute('data-event-bound', 'true');
        }
        
        // 导入按钮
        const importBtn = document.getElementById('import-scenario-btn');
        if (importBtn && !importBtn.hasAttribute('data-event-bound')) {
            importBtn.addEventListener('click', () => {
                this.managePage.showDialogWithAnimation(this.managePage.importDialog);
            });
            importBtn.setAttribute('data-event-bound', 'true');
        }
        
        // 导出按钮
        const exportBtn = document.getElementById('export-all-btn');
        if (exportBtn && !exportBtn.hasAttribute('data-event-bound')) {
            exportBtn.addEventListener('click', () => {
                const exportPath = this.settingsManager.getSetting('exportPath');
                document.getElementById('export-path').value = exportPath;
                this.managePage.showDialogWithAnimation(this.managePage.exportDialog);
            });
            exportBtn.setAttribute('data-event-bound', 'true');
        }
    }
    
    setupSidebarButtons() {
        // 侧栏设置按钮
        const sidebarSettingsBtn = document.getElementById('sidebar-settings-btn');
        if (sidebarSettingsBtn && !sidebarSettingsBtn.hasAttribute('data-event-bound')) {
            sidebarSettingsBtn.addEventListener('click', () => {
                this.settingsManager.openSettings();
            });
            sidebarSettingsBtn.setAttribute('data-event-bound', 'true');
        }
        
        // 侧栏导入按钮
        const sidebarImportBtn = document.getElementById('sidebar-import-btn');
        if (sidebarImportBtn && !sidebarImportBtn.hasAttribute('data-event-bound')) {
            sidebarImportBtn.addEventListener('click', () => {
                this.managePage.showDialogWithAnimation(this.managePage.importDialog);
            });
            sidebarImportBtn.setAttribute('data-event-bound', 'true');
        }
        
        // 侧栏导出按钮
        const sidebarExportBtn = document.getElementById('sidebar-export-btn');
        if (sidebarExportBtn && !sidebarExportBtn.hasAttribute('data-event-bound')) {
            sidebarExportBtn.addEventListener('click', () => {
                const exportPath = this.settingsManager.getSetting('exportPath');
                document.getElementById('export-path').value = exportPath;
                this.managePage.showDialogWithAnimation(this.managePage.exportDialog);
            });
            sidebarExportBtn.setAttribute('data-event-bound', 'true');
        }
    }
    
    navigateTo(page) {
        if (Core.isDebugMode()) {
            Core.logDebug('APP', `Navigating to page: ${page}`);
            Core.showToast(`[DEBUG] Switching to ${page} page`, 'info');
        }
        
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        
        // 更新侧栏导航状态
        document.querySelectorAll('.sidebar-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        
        // 更新页面显示
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
        });
        
        // 更新标题和FAB
        const titles = {
            home: Core.t('nav.home'),
            manage: Core.t('nav.manage')
        };
        
        document.getElementById('page-title').textContent = titles[page] || Core.t('nav.home');
        
        const fab = document.getElementById('fab');
        fab.style.display = page === 'manage' ? 'flex' : 'none';
        
        this.currentPage = page;
        
        // 重新加载情景并刷新页面内容
        if (page === 'home') {
            this.loadScenarios().then(() => {
                this.homePage.refresh();
                if (Core.isDebugMode()) {
                    Core.logDebug('APP', 'Home page refresh completed');
                }
            });
        } else if (page === 'manage') {
            this.loadScenarios().then(() => {
                this.managePage.refresh();
                if (Core.isDebugMode()) {
                    Core.logDebug('APP', 'Manage page refresh completed');
                }
            });
        }
    }
    
    async loadScenarios() {
        if (Core.isDebugMode()) {
            Core.logDebug('APP', 'Starting to load scenario data');
        }
        
        try {
            await this.scenarioManager.loadScenarios();
            
            if (Core.isDebugMode()) {
                const scenarioCount = this.scenarioManager.getScenarios().length;
                Core.logDebug('APP', `Scenarios loaded successfully, total: ${scenarioCount}`);
                Core.showToast(`[DEBUG] Loaded ${scenarioCount} scenarios`, 'success');
            }
            
            this.homePage.refresh();
            this.managePage.refresh();
        } catch (error) {
            console.error('Failed to load scenarios:', error);
            if (Core.isDebugMode()) {
                Core.logDebug('APP', `Failed to load scenarios: ${error.message}`);
                Core.showToast(`[DEBUG] Scenario loading failed: ${error.message}`, 'error');
            }
            Core.showError(error.message, Core.t('app.loading.initializing'));
        }
    }
    
    async loadScenariosAsync() {
        try {
            // 更新加载状态
            updateLoadingIndicator('app.loading.scenarios');
            
            // 加载情景数据
            await this.scenarioManager.loadScenarios();
            
            // 更新UI
            this.updateUI();
            
            // 延迟隐藏加载指示器，确保UI已渲染
            setTimeout(() => {
                hideLoadingIndicator();
            }, 500);
            
            Core.logDebug('Scenarios loaded successfully');
            
        } catch (error) {
            Core.logDebug(`Failed to load scenarios: ${error.message}`);
            hideLoadingIndicator();
            
            if (Core.isDebugMode()) {
                Core.showToast(`[DEBUG] Scenario loading failed: ${error.message}`, 'error');
            }
        }
    }
    
    showApp() {
        // 显示应用
        document.getElementById('app').style.opacity = '1';
        document.body.classList.add('app-loaded');
    }
}

// 更新加载指示器文本
function updateLoadingIndicator(message = 'app.loading.initializing') {
    const loadingText = document.querySelector('#initial-loading .loading-text');
    if (loadingText && window.I18n) {
        loadingText.textContent = window.I18n.t(message);
    }
}

// 隐藏加载指示器
function hideLoadingIndicator() {
    const overlay = document.getElementById('initial-loading');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            document.body.classList.add('app-loaded');
        }, 300);
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', async () => {
    updateLoadingIndicator('app.loading.initializing');
    
    try {
        // 创建App实例并等待初始化完成
        const app = new App();
        
        // 延迟隐藏加载指示器，确保UI已渲染
        setTimeout(() => {
            hideLoadingIndicator();
        }, 500);
        
    } catch (error) {
        console.error('Application initialization failed:', error);
        hideLoadingIndicator();
        if (Core.isDebugMode()) {
            Core.showToast(`[DEBUG] Application startup failed: ${error.message}`, 'error');
        }
    }
});

// 导出给全局使用
window.App = App;
window.SettingsManager = SettingsManager;