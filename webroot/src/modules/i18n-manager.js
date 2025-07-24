/**
 * I18nManager - Internationalization Manager
 * Handles language switching, text translation, and locale storage
 */
class I18nManager {
    constructor() {
        this.currentLanguage = 'zh-CN';
        this.translations = {};
        this.fallbackLanguage = 'zh-CN';
        this.supportedLanguages = {
            'zh-CN': '中文',
            'en-US': 'English',
            'ru-RU': 'Русский'
        };
        
        this.init();
    }

    /**
     * Initialize i18n manager
     */
    async init() {
        try {
            // Load saved language preference from localStorage
            const savedLanguage = localStorage.getItem('app_language');
            
            // Also check settings manager for language preference
            let settingsLanguage = null;
            try {
                const savedSettings = localStorage.getItem('switchprofile-settings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    settingsLanguage = settings.language;
                }
            } catch (e) {
                // Ignore settings parsing errors
            }
            
            // Detect browser language if no saved preference
            let browserLanguage = null;
            if (!savedLanguage && !settingsLanguage) {
                browserLanguage = this.detectBrowserLanguage();
                if (window.Core && Core.isDebugMode()) {
                    Core.logDebug('I18N', `Detected browser language: ${browserLanguage}`);
                }
            }
            
            // Priority: savedLanguage > settingsLanguage > browserLanguage > default
            let targetLanguage = this.currentLanguage;
            if (savedLanguage && this.supportedLanguages[savedLanguage]) {
                targetLanguage = savedLanguage;
            } else if (settingsLanguage && this.supportedLanguages[settingsLanguage]) {
                targetLanguage = settingsLanguage;
                // Sync to localStorage
                localStorage.setItem('app_language', settingsLanguage);
            } else if (browserLanguage && this.supportedLanguages[browserLanguage]) {
                targetLanguage = browserLanguage;
                // Save detected language to localStorage
                localStorage.setItem('app_language', browserLanguage);
                if (window.Core && Core.isDebugMode()) {
                    Core.logDebug('I18N', `Auto-set language to: ${browserLanguage}`);
                }
            }
            
            this.currentLanguage = targetLanguage;

            // Set document language immediately
            document.documentElement.lang = this.currentLanguage;
            
            // Load only current language first for faster startup
            await this.loadCurrentLanguage();
            
            // Update DOM immediately after initialization
            this.updateDOM();
            
            // Load other languages in background
            this.loadOtherLanguagesInBackground();
            
            if (window.Core && Core.isDebugMode()) {
                Core.logDebug('I18N', `Initialized with language: ${this.currentLanguage}`);
            }
        } catch (error) {
            console.error('Failed to initialize I18nManager:', error);
            if (window.Core && Core.isDebugMode()) {
                Core.logDebug('I18N', `Initialization failed: ${error.message}`);
            }
        }
    }

    /**
     * Load current language translation file
     */
    async loadCurrentLanguage() {
        try {
            const response = await fetch(`./src/i18n/${this.currentLanguage}.json`);
            if (response.ok) {
                this.translations[this.currentLanguage] = await response.json();
                if (window.Core && Core.isDebugMode()) {
                    Core.logDebug('I18N', `Loaded translations for ${this.currentLanguage}`);
                }
            } else {
                console.warn(`Failed to load translations for ${this.currentLanguage}:`, response.status);
                // Load fallback language if current fails
                if (this.currentLanguage !== this.fallbackLanguage) {
                    await this.loadFallbackLanguage();
                }
            }
        } catch (error) {
            console.error(`Error loading translations for ${this.currentLanguage}:`, error);
            // Load fallback language if current fails
            if (this.currentLanguage !== this.fallbackLanguage) {
                await this.loadFallbackLanguage();
            }
        }
    }

    /**
     * Load fallback language
     */
    async loadFallbackLanguage() {
        try {
            const response = await fetch(`./src/i18n/${this.fallbackLanguage}.json`);
            if (response.ok) {
                this.translations[this.fallbackLanguage] = await response.json();
                if (window.Core && Core.isDebugMode()) {
                    Core.logDebug('I18N', `Loaded fallback translations for ${this.fallbackLanguage}`);
                }
            } else {
                // Use minimal fallback if even fallback language fails
                this.translations[this.fallbackLanguage] = {
                    app: { title: 'SwitchProfile' },
                    home: { empty: { title: 'No scenarios' } }
                };
            }
        } catch (error) {
            console.error(`Error loading fallback translations:`, error);
            // Use minimal fallback
            this.translations[this.fallbackLanguage] = {
                app: { title: 'SwitchProfile' },
                home: { empty: { title: 'No scenarios' } }
            };
        }
    }

    /**
     * Load translations for a specific language
     * @param {string} language - Language code
     */
    async loadLanguageTranslations(language) {
        try {
            const response = await fetch(`./src/i18n/${language}.json`);
            if (response.ok) {
                this.translations[language] = await response.json();
                if (window.Core && Core.isDebugMode()) {
                    Core.logDebug('I18N', `Loaded translations for ${language}`);
                }
                return true;
            } else {
                console.warn(`Failed to load translations for ${language}:`, response.status);
                return false;
            }
        } catch (error) {
            console.error(`Error loading translations for ${language}:`, error);
            return false;
        }
    }

    /**
     * Load other languages in background
     */
    loadOtherLanguagesInBackground() {
        const otherLanguages = Object.keys(this.supportedLanguages)
            .filter(lang => lang !== this.currentLanguage && lang !== this.fallbackLanguage);
        
        // Load other languages with delay to not block UI
        setTimeout(async () => {
            for (const language of otherLanguages) {
                if (!this.translations[language]) {
                    await this.loadLanguageTranslations(language);
                    // Small delay between loads to prevent blocking
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }, 100);
    }

    /**
     * Load translation files for all supported languages
     */
    async loadTranslations() {
        const loadPromises = Object.keys(this.supportedLanguages).map(async (lang) => {
            try {
                const response = await fetch(`./src/i18n/${lang}.json`);
                if (response.ok) {
                    this.translations[lang] = await response.json();
                    if (window.Core && Core.isDebugMode()) {
                        Core.logDebug('I18N', `Loaded translations for ${lang}`);
                    }
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error(`Failed to load translations for ${lang}:`, error);
                if (window.Core && Core.isDebugMode()) {
                    Core.logDebug('I18N', `Failed to load ${lang}: ${error.message}`);
                }
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * Get translated text by key
     * @param {string} key - Translation key (e.g., 'app.title', 'home.empty.title')
     * @param {Object} params - Parameters for string interpolation
     * @returns {string} Translated text
     */
    t(key, params = {}) {
        try {
            const keys = key.split('.');
            let translation = this.translations[this.currentLanguage];
            
            // Navigate through nested object
            for (const k of keys) {
                if (translation && typeof translation === 'object' && k in translation) {
                    translation = translation[k];
                } else {
                    translation = null;
                    break;
                }
            }

            // Fallback to fallback language if translation not found
            if (!translation && this.currentLanguage !== this.fallbackLanguage) {
                let fallbackTranslation = this.translations[this.fallbackLanguage];
                for (const k of keys) {
                    if (fallbackTranslation && typeof fallbackTranslation === 'object' && k in fallbackTranslation) {
                        fallbackTranslation = fallbackTranslation[k];
                    } else {
                        fallbackTranslation = null;
                        break;
                    }
                }
                translation = fallbackTranslation;
            }

            // Return key if no translation found
            if (!translation) {
                if (window.Core && Core.isDebugMode()) {
                    Core.logDebug('I18N', `Missing translation for key: ${key}`);
                }
                return key;
            }

            // Handle string interpolation
            if (typeof translation === 'string' && Object.keys(params).length > 0) {
                return translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
                    return params[paramKey] || match;
                });
            }

            return translation;
        } catch (error) {
            console.error('Translation error:', error);
            if (window.Core && Core.isDebugMode()) {
                Core.logDebug('I18N', `Translation error for key ${key}: ${error.message}`);
            }
            return key;
        }
    }

    /**
     * Change current language
     * @param {string} language - Language code
     * @param {boolean} skipSettingsSync - Skip syncing to settings manager to prevent circular calls
     */
    async setLanguage(language, skipSettingsSync = false) {
        if (!this.supportedLanguages[language]) {
            console.error(`Unsupported language: ${language}`);
            return false;
        }

        try {
            const oldLanguage = this.currentLanguage;
            this.currentLanguage = language;
            localStorage.setItem('app_language', language);
            document.documentElement.lang = language;
            
            // 确保目标语言的翻译文件已加载
            if (!this.translations[language]) {
                await this.loadLanguageTranslations(language);
            }
            
            // 同步到settings manager (避免循环调用)
            if (!skipSettingsSync && window.settingsManager) {
                const currentSetting = window.settingsManager.getSetting('language');
                if (currentSetting !== language) {
                    window.settingsManager.settings.language = language;
                    window.settingsManager.saveSettings();
                }
            }
            
            // 立即更新DOM
            this.updateDOM();
            
            // Trigger language change event
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language, translations: this.translations[language], oldLanguage }
            }));

            if (window.Core && Core.isDebugMode()) {
                Core.logDebug('I18N', `Language changed from ${oldLanguage} to: ${language}`);
            }

            return true;
        } catch (error) {
            console.error('Failed to set language:', error);
            if (window.Core && Core.isDebugMode()) {
                Core.logDebug('I18N', `Failed to set language ${language}: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * Get current language
     * @returns {string} Current language code
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get supported languages
     * @returns {Object} Supported languages object
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    /**
     * Check if a language is supported
     * @param {string} language - Language code
     * @returns {boolean} Whether the language is supported
     */
    isLanguageSupported(language) {
        return language in this.supportedLanguages;
    }

    /**
     * Get language display name
     * @param {string} language - Language code
     * @returns {string} Display name
     */
    getLanguageDisplayName(language) {
        return this.supportedLanguages[language] || language;
    }

    /**
     * Detect browser language
     * @returns {string|null} Detected language code or null if not supported
     */
    detectBrowserLanguage() {
        // Get browser languages in order of preference
        const browserLanguages = navigator.languages || [navigator.language || navigator.userLanguage];
        
        for (const lang of browserLanguages) {
            // Check exact match first
            if (this.supportedLanguages[lang]) {
                return lang;
            }
            
            // Check language code without region (e.g., 'en' from 'en-GB')
            const langCode = lang.split('-')[0];
            for (const supportedLang of Object.keys(this.supportedLanguages)) {
                if (supportedLang.startsWith(langCode + '-')) {
                    return supportedLang;
                }
            }
        }
        
        return null;
    }

    /**
     * Update all translatable elements in the DOM
     */
    updateDOM() {
        try {
            // Update elements with data-i18n attribute
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(element => {
                const key = element.getAttribute('data-i18n');
                const translation = this.t(key);
                
                if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'search')) {
                    element.placeholder = translation;
                } else {
                    element.textContent = translation;
                }
            });

            // Update elements with data-i18n-placeholder attribute
            const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
            placeholderElements.forEach(element => {
                const key = element.getAttribute('data-i18n-placeholder');
                element.placeholder = this.t(key);
            });

            // Update elements with data-i18n-title attribute
            const titleElements = document.querySelectorAll('[data-i18n-title]');
            titleElements.forEach(element => {
                const key = element.getAttribute('data-i18n-title');
                element.title = this.t(key);
            });

            if (window.Core && Core.isDebugMode()) {
                Core.logDebug('I18N', `Updated ${elements.length + titleElements.length + (document.querySelectorAll('[data-i18n-placeholder]').length || 0)} DOM elements`);
            }
        } catch (error) {
            console.error('Failed to update DOM:', error);
            if (window.Core && Core.isDebugMode()) {
                Core.logDebug('I18N', `DOM update failed: ${error.message}`);
            }
        }
    }
}

// Create global instance
window.I18n = new I18nManager();

// Listen for language change events for additional processing
window.addEventListener('languageChanged', (event) => {
    if (window.Core && Core.isDebugMode()) {
        Core.logDebug('I18N', `Language change event received: ${event.detail.oldLanguage} -> ${event.detail.language}`);
    }
    // DOM is already updated in setLanguage method
    // Additional language change handling can be added here if needed
});

export default I18nManager;