'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'day' | 'oled';
type FontSize = 'normal' | 'large' | 'xlarge';

interface SettingsContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    fontScale: number;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>('oled'); // Default to OLED for requested "OLED on OLED"
    const [fontSize, setFontSize] = useState<FontSize>('normal');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Load saved settings
        const savedTheme = localStorage.getItem('app-theme') as Theme;
        const savedFontSize = localStorage.getItem('app-font-size') as FontSize;

        if (savedTheme) setTheme(savedTheme);
        if (savedFontSize) setFontSize(savedFontSize);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            localStorage.setItem('app-theme', theme);
            localStorage.setItem('app-font-size', fontSize);

            // Apply class to body for global styling if needed
            document.body.className = theme === 'oled' ? 'theme-oled' : 'theme-day';

            // KEY FIX: Apply font-size to HTML root (documentElement) so 'rem' units scale
            // Default browser size is usually 16px. We scale relative to that.
            const baseSize = 16;
            const newSize = fontSize === 'normal' ? baseSize : fontSize === 'large' ? baseSize * 1.125 : baseSize * 1.25;
            document.documentElement.style.fontSize = `${newSize}px`;
        }
    }, [theme, fontSize, mounted]);

    const fontScale = fontSize === 'normal' ? 1 : fontSize === 'large' ? 1.125 : 1.25;

    // Prevent hydration mismatch by not rendering specific theme dependent UI until mounted
    // But we render children to not block app load
    return (
        <SettingsContext.Provider value={{ theme, setTheme, fontSize, setFontSize, fontScale }}>
            <div className={`${theme === 'oled' ? 'bg-black text-white' : 'bg-[#f8fafc] text-slate-900'} min-h-[100dvh] transition-colors duration-300`}>
                {children}
            </div>
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
