import { Core } from './core.js';
import { HomePage } from './modules/home.js';
import { ManagePage } from './modules/manage.js';
import { ScenarioManager } from './modules/scenario-manager.js';
import { FileManager } from './modules/file-manager.js';
import { SettingsManager } from './modules/settings-manager.js';
import './modules/dialog-manager.js';

class App {
    constructor() {
        this.currentPage = 'home';
        this.scenarioManager = new ScenarioManager();
        this.fileManager = new FileManager();
        this.settingsManager = new SettingsManager();
        this.homePage = new HomePage(this.scenarioManager, this.settingsManager);
        this.managePage = new ManagePage(this.scenarioManager, this.fileManager);
        
        this.init();
    }
    
    init() {
        this.setupNavigation();
        this.setupFAB();
        this.settingsManager.initializeUI();
        this.loadScenarios();
        this.showApp();
    }
    
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    }
    
    setupFAB() {
        const fab = document.getElementById('fab');
        fab.addEventListener('click', () => {
            if (this.currentPage === 'manage') {
                this.managePage.showEditDialog();
            }
        });
    }
    
    navigateTo(page) {
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        
        // 更新页面显示
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
        });
        
        // 更新标题和FAB
        const titles = {
            home: '情景模式',
            manage: '情景管理'
        };
        
        document.getElementById('page-title').textContent = titles[page] || '情景模式';
        
        const fab = document.getElementById('fab');
        fab.style.display = page === 'manage' ? 'flex' : 'none';
        
        this.currentPage = page;
        
        // 刷新页面内容
        if (page === 'home') {
            this.homePage.refresh();
        } else if (page === 'manage') {
            this.managePage.refresh();
        }
    }
    
    async loadScenarios() {
        try {
            await this.scenarioManager.loadScenarios();
            this.homePage.refresh();
            this.managePage.refresh();
        } catch (error) {
            console.error('Failed to load scenarios:', error);
            Core.showToast('加载情景失败', 'error');
        }
    }
    
    showApp() {
        // 显示应用
        document.getElementById('app').style.opacity = '1';
        document.body.classList.add('app-loaded');
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

// 导出给全局使用
window.App = App;
window.SettingsManager = SettingsManager;