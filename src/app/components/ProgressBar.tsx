'use client';

import { motion } from 'framer-motion';

export default function ProgressBar({ current, target = 100000, theme }: { current: number; target?: number; theme?: string }) {
    const percentage = Math.min((current / target) * 100, 100);
    const realPercentage = Math.round((current / target) * 100);

    const bgClass = theme === 'oled' ? 'bg-gray-800' : 'bg-slate-100';
    const textClass = theme === 'oled' ? 'text-gray-400' : 'text-slate-500';
    const borderClass = theme === 'oled' ? 'border-white/5' : 'border-slate-200';

    return (
        <div className="w-full relative pt-2">
            <div className="flex mb-3 items-center justify-between">
                <div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${textClass}`}>
                        İlerleme
                    </span>
                </div>
                <div className="text-right">
                    <span className={`text-sm font-bold ${theme === 'oled' ? 'text-white' : 'text-slate-900'}`}>
                        {realPercentage}%
                    </span>
                </div>
            </div>
            <div className={`overflow-hidden h-6 mb-4 text-xs flex rounded-full border relative ${bgClass} ${borderClass}`}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="shadow-md flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600"
                />
                {/* Shine effect on bar */}
                <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-full" />
            </div>
            <div className="flex justify-between text-xs opacity-60 font-mono tracking-tighter">
                <span>0</span>
                <span className="font-bold text-red-400 text-sm">Kalan: {(target - current).toLocaleString()}</span>
                <span>{target.toLocaleString()}</span>
            </div>
        </div>
    );
}
