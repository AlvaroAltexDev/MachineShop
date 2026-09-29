import { createContext, useState, useEffect, useContext, useCallback } from 'react';

const ThemeContext = createContext();
const STORAGE_KEY = 'ms-theme'; // 'light' | 'dark'

const initialTheme = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {
        console.warn('No se pudo leer el tema guardado:', e);
    }
    // Primera vez: respetar el tema del sistema; por defecto oscuro
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(initialTheme);

    useEffect(() => {
        document.body.classList.toggle('light', theme === 'light');
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (e) {
                console.warn('No se pudo guardar el tema:', e);
            }
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isLight: theme === 'light' }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
