/**
 * Locale Service
 * Manages number formatting preferences.
 */

const LOCALE_STORAGE_KEY = 'user_preferred_locale';

/**
 * Detects a locale that uses a dot (.) as a decimal separator.
 * Priority:
 * 1. User manual override (localStorage)
 * 2. User browser preferences (navigator.languages) for a dot-using locale
 * 3. Fallback to 'en-US'
 */
export const getDotDecimalLocale = () => {
    if (typeof navigator === 'undefined') return 'en-US';

    // 1. Check for manual override
    try {
        const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
        // If user explicitly selected 'auto' (or cleared it), we skip this.
        // But if they selected a specific locale, we use it.
        // We assume the verified logic that calls this function WANTS a dot.
        // However, if the user forced 'es-AR' via settings, they WANT a comma.
        // This function's name 'getDotDecimalLocale' implies it *tries* to find a dot locale.
        // But if we use it for *all* formatting, it effectively determines the app's number format.
        
        // If the user manually set 'es-AR', and we return it here, the app will use Commas. 
        // This is correct behavior for a "Regional Format" setting.
        if (stored && stored !== 'auto') return stored;
    } catch (e) {
        console.warn('LocalStorage access invalid', e);
    }

    // 2. Smart Detection
    const testNumber = 1.1;
    const languages = navigator.languages || [navigator.language];

    for (const lang of languages) {
        try {
            const formatter = new Intl.NumberFormat(lang);
            const formatted = formatter.format(testNumber);
            if (formatted.includes('.')) {
                return lang;
            }
        } catch (e) {
            // Ignore invalid locales
        }
    }

    return 'en-US'; // Fallback ensures dot decimal
};

/**
 * Save user preference
 * @param {string} locale - 'en-US', 'es-AR', or 'auto'
 */
export const saveUserLocale = (locale) => {
    if (locale === 'auto') {
        localStorage.removeItem(LOCALE_STORAGE_KEY);
    } else {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
};

/**
 * Get current user preference
 * @returns {string} - 'en-US', 'es-AR', or 'auto' (default)
 */
export const getUserLocale = () => {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || 'auto';
};

export const AVAILABLE_LOCALES = [
    { code: 'auto', label: 'Automático (según navegador)' },
    { code: 'en-US', label: 'EE.UU. (1,234.56)' },
    { code: 'es-AR', label: 'Argentina (1.234,56)' },
];
