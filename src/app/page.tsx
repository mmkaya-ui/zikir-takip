'use client';

import useSWR from 'swr';
import { useState } from 'react';
import ReadingForm from './components/ReadingForm';
import ProgressBar from './components/ProgressBar';
import { motion } from 'framer-motion';
import { useSettings } from './context/SettingsContext';
import HelpModal from './components/HelpModal';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const { theme, setTheme, fontScale, fontSize, setFontSize } = useSettings();
  const [showHelp, setShowHelp] = useState(false);

  // Poll every 10 seconds
  const { data, error, mutate } = useSWR('/api/readings', fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    shouldRetryOnError: true,
    errorRetryInterval: 5000
  });

  const loading = !data && !error;
  const total = data?.total || 0;

  const dateStr = data?.date;
  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  }) + ' (TR)' : 'Yükleniyor...';

  const errorMessage = data?.error;

  const toggleTheme = () => {
    setTheme(theme === 'oled' ? 'day' : 'oled');
  };

  const cycleFontSize = () => {
    if (fontSize === 'normal') setFontSize('large');
    else if (fontSize === 'large') setFontSize('xlarge');
    else setFontSize('normal');
  };

  const cardClass = theme === 'oled'
    ? 'bg-[#111] border-white/10 shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)]'
    : 'bg-white border-indigo-100 shadow-[0_10px_40px_-5px_rgba(79,70,229,0.1)]';

  const textGradient = theme === 'oled'
    ? 'from-emerald-300 via-white to-emerald-300'
    : 'from-emerald-600 via-green-700 to-emerald-800';

  return (
    <main className={`min-h-[100dvh] w-full flex flex-col items-center py-6 px-4 relative transition-colors duration-500 font-sans`}>
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {theme === 'oled' ? (
          <>
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px] opacity-30"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px] opacity-30"></div>
          </>
        ) : (
          <>
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/60 rounded-full blur-[120px] mix-blend-multiply opacity-70"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100/60 rounded-full blur-[100px] mix-blend-multiply opacity-70"></div>
          </>
        )}
      </div>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} theme={theme} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-sm flex flex-col relative z-10 gap-3"
      >
        {/* Header Section */}
        <div className="text-center space-y-0.5 relative shrink-0 pt-2">
          {/* Quick Theme Toggle (Left) */}
          <button
            onClick={toggleTheme}
            className={`absolute left-0 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all active:scale-95 border ${theme === 'oled'
              ? 'bg-white/5 text-yellow-300 border-white/20 hover:bg-white/10'
              : 'bg-white text-orange-500 border-slate-200 shadow-sm hover:bg-slate-50'
              }`}
            aria-label="Temayı Değiştir"
          >
            {theme === 'oled' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>

          {/* Quick Font Size Toggle (Right) */}
          <button
            onClick={cycleFontSize}
            className={`absolute right-0 top-1/2 -translate-y-1/2 w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all active:scale-95 border ${theme === 'oled'
              ? 'bg-white/5 text-blue-300 border-white/20 hover:bg-white/10'
              : 'bg-white text-slate-500 border-slate-200 shadow-sm hover:bg-slate-50'
              }`}
            aria-label="Yazı Boyutunu Değiştir"
          >
            <span className={`font-bold leading-none transition-all duration-300 ${fontSize === 'normal' ? 'text-lg' : fontSize === 'large' ? 'text-xl' : 'text-2xl'}`}>
              A
            </span>
          </button>

          <motion.div>
            <h1 className={`text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${textGradient}`}>
              İhlas-ı Şerif
            </h1>
            <p className={`text-sm font-bold tracking-widest uppercase opacity-80 mt-1`}>
              {formattedDate}
            </p>
          </motion.div>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-2 rounded-xl text-center text-xs font-semibold backdrop-blur-md shrink-0">
            {errorMessage === 'Setup Required' ? 'Kurulum Gerekli' : errorMessage}
          </div>
        )}

        {/* Stats Card */}
        <motion.div
          className={`rounded-2xl p-4 border backdrop-blur-2xl relative overflow-hidden group transition-colors duration-500 shrink-0 ${cardClass}`}
        >
          {loading ? (
            <div className="animate-pulse space-y-4 flex flex-col items-center">
              <div className={`h-12 w-32 rounded-lg ${theme === 'oled' ? 'bg-white/10' : 'bg-black/5'}`}></div>
              <div className={`h-2 w-full rounded-full ${theme === 'oled' ? 'bg-white/10' : 'bg-black/5'}`}></div>
            </div>
          ) : (
            <>
              <div className="text-center mb-2">
                <div className={`text-6xl font-bold font-mono tracking-tighter drop-shadow-sm relative inline-block transition-colors duration-300 leading-none ${theme === 'oled' ? 'text-white' : 'text-slate-900'}`}>
                  {total.toLocaleString()}
                </div>
                <div className="text-sm text-blue-500 mt-2 uppercase tracking-[0.2em] font-bold opacity-90">
                  Bugünkü Toplam
                </div>
              </div>

              <ProgressBar current={total} target={100000} theme={theme} />
            </>
          )}
        </motion.div>

        {/* Reading Form - Directly below stats card */}
        <div className="shrink-0">
          <ReadingForm onAdd={() => mutate()} theme={theme} />
        </div>

        {/* Footer with Help Button - tight below form */}
        <div className="text-center shrink-0 flex flex-col items-center gap-2 mt-2">
          <div className="text-xs font-bold opacity-60 uppercase tracking-widest">
            Her gün Türkiye saati 22:00{"'"}da sıfırlanır
          </div>

          <button
            onClick={() => setShowHelp(true)}
            className={`text-sm font-bold px-4 py-1.5 rounded-full border transition-all ${theme === 'oled'
              ? 'border-white/10 text-emerald-400 hover:bg-white/10'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
          >
            Nasıl Çalışır? ℹ️
          </button>
        </div>

      </motion.div>
    </main>
  );
}
