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
    const [theme, setTheme] = useState<Theme>('oled');
    const [fontSize, setFontSize] = useState<FontSize>('normal');
    const [mounted, setMounted] = useState(false);

    // Approximate Istanbul Sunrise/Sunset Data (Month: [Sunrise, Sunset])
    // Used for auto-theme: Day starts Sunrise+1h, Night starts Sunset+2h
    const getSeasonalTheme = (): Theme => {
        const now = new Date();
        const month = now.getMonth(); // 0-11
        const hour = now.getHours();

        // Data for Istanbul (approx 15th of each month)
        const sunData = [
            { rise: 8.5, set: 18.0 }, // Jan
            { rise: 8.0, set: 18.7 }, // Feb
            { rise: 7.25, set: 19.25 }, // Mar
            { rise: 6.4, set: 19.8 }, // Apr
            { rise: 5.75, set: 20.3 }, // May
            { rise: 5.5, set: 20.7 }, // Jun
            { rise: 5.7, set: 20.6 }, // Jul
            { rise: 6.2, set: 20.0 }, // Aug
            { rise: 6.7, set: 19.25 }, // Sep
            { rise: 7.2, set: 18.5 }, // Oct
            { rise: 7.8, set: 17.8 }, // Nov
            { rise: 8.3, set: 17.7 }, // Dec
        ];

        const { rise, set } = sunData[month];

        // Day Mode: Sunrise + 1 hour -> Sunset + 2 hours (wait, night is Sunset+2)
        // User asked: "gunes dogduktan 1 saat sonra gunduz", "gunes battiktan 2 saat sonra gece"
        // So Day interval: [Sunrise + 1, Sunset + 2]

        const dayStart = rise + 1;
        const nightStart = set + 2;

        if (hour >= dayStart && hour < nightStart) {
            return 'day';
        } else {
            return 'oled';
        }
    };

    useEffect(() => {
        // Load saved settings or default to seasonal auto
        const savedTheme = localStorage.getItem('app-theme') as Theme;
        const savedFontSize = localStorage.getItem('app-font-size') as FontSize;

        if (savedTheme) {
            setTheme(savedTheme);
        } else {
            // No saved theme? Use smart auto!
            setTheme(getSeasonalTheme());
        }

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
