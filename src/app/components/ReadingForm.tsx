'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function ReadingForm({ onAdd, theme }: { onAdd: () => void, theme?: string }) {
    const [name, setName] = useState('');
    const [count, setCount] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const savedName = localStorage.getItem('userName');
        if (savedName) setName(savedName);
    }, []);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const isNegative = count.trim().startsWith('-');

    const submitReading = async (forceConfirm = false) => {
        if (!name || !count) return;

        const finalCount = parseInt(count);
        if (Math.abs(finalCount) > 10000) {
            alert('Tek seferde en fazla 10.000 girilebilir.');
            return;
        }
        if (Math.abs(finalCount) > 2000 && !forceConfirm) {
            const confirmed = window.confirm(`${Math.abs(finalCount).toLocaleString()} adet girdiniz, onaylıyor musunuz?`);
            if (!confirmed) return;
        }

        setLoading(true);
        localStorage.setItem('userName', name);

        try {

            const res = await fetch('/api/readings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    count: finalCount,
                    confirmCorrection: forceConfirm
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setCount('');
                setSuccess(true);
                setSuccessMessage(Math.random() > 0.5 ? 'Allah Kabul Etsin 🤲' : 'Allah Razı Olsun 🌹');
                onAdd();
            } else if (res.status === 409 && data.requiresConfirmation) {
                // Show confirmation dialog logic
                const confirmed = window.confirm(
                    `${data.message}\n\nMevcut bakiyeniz kadar (${data.maxSubtractable}) düşülsün mü?`
                );

                if (confirmed) {
                    // Retry with confirmation flag
                    await submitReading(true);
                    return; // exit to avoid setting loading=false too early
                }
            } else {
                alert(data.message || 'Kaydedilirken bir hata oluştu.');
            }
        } catch (err) {
            console.error(err);
            alert('Bir bağlantı hatası oluştu.');
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitReading(false);
    };

    const inputBgClass = theme === 'oled'
        ? 'bg-gray-900/50 border-gray-800 text-white placeholder-gray-600 focus:ring-blue-500/50'
        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-blue-500/50 focus:border-blue-500';

    const labelClass = theme === 'oled' ? 'text-gray-400' : 'text-slate-500';

    const containerClass = theme === 'oled'
        ? 'bg-white/5 border-white/10 shadow-xl'
        : 'bg-white border-indigo-100 shadow-xl shadow-indigo-100/50';

    return (
        <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onSubmit={handleSubmit}
            className={`p-5 rounded-2xl border backdrop-blur-lg space-y-3 transition-colors duration-500 ${containerClass}`}
        >
            <div className="flex gap-3">
                <div className="flex-1">
                    <label htmlFor="name" className={`block text-xs font-bold uppercase tracking-wider mb-1 ml-1 ${labelClass}`}>İsim</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`w-full px-3 py-3 rounded-xl border outline-none transition-all font-medium text-sm ${inputBgClass}`}
                        placeholder="Adınız"
                        required
                    />
                </div>

                <div className="w-1/3">
                    <label htmlFor="count" className={`block text-xs font-bold uppercase tracking-wider mb-1 ml-1 ${labelClass}`}>Adet</label>
                    <input
                        id="count"
                        type="number"
                        value={count}
                        onChange={(e) => setCount(e.target.value)}

                        className={`w-full px-3 py-3 rounded-xl border outline-none transition-all font-medium text-sm ${inputBgClass} ${isNegative ? 'text-red-500' : ''}`}
                        placeholder="0"
                        required
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className={`w-full font-bold py-3 px-4 rounded-xl transition-all shadow-lg transform active:scale-[0.98] text-sm ${success
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                    : isNegative
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {loading ? '...' : success ? successMessage : isNegative ? 'Düzelt (Çıkar)' : 'Kaydet'}
            </button>
        </motion.form>
    );
}
