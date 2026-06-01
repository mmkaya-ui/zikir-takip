import { motion, AnimatePresence } from 'framer-motion';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: string;
    dhikrName?: string;
    resetHour?: number;
}

export default function HelpModal({ isOpen, onClose, theme, dhikrName = 'Zikir', resetHour = 22 }: HelpModalProps) {
    if (!isOpen) return null;

    const isOled = theme === 'oled';
    const bgColor = isOled ? 'bg-[#1a1a1a]' : 'bg-white';
    const textColor = isOled ? 'text-white' : 'text-slate-900';
    const borderColor = isOled ? 'border-white/10' : 'border-slate-200';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
                onClick={onClose}
            >
                <div
                    className={`${bgColor} ${borderColor} border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative overflow-hidden`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                        </div>
                        <h2 className={`text-lg font-bold ${textColor}`}>Nasıl Çalışır?</h2>
                    </div>

                    {/* Content */}
                    <div className={`space-y-4 text-sm leading-relaxed ${isOled ? 'text-gray-300' : 'text-slate-600'}`}>
                        <p>
                            <span className="font-bold text-emerald-500 block mb-1">Ortak Kayıt Defteri 📖</span>
                            Okuduğunuz {dhikrName} adetleri, ortak bir dijital kayıt defterine otomatik olarak işlenir. Herkesin okumaları tek bir yerde toplanır.
                        </p>

                        <p>
                            <span className="font-bold text-emerald-500 block mb-1">Her Gece Yeni Sayfa 🌙</span>
                            Her gece Türkiye saatiyle <strong>{String(resetHour).padStart(2, '0')}:00</strong>{"'"}{
                                ({0:'da',1:'de',2:'de',3:'te',4:'te',5:'te',6:'da',7:'de',8:'de',9:'da',10:'da',11:'de',12:'de',13:'te',14:'te',15:'te',16:'da',17:'de',18:'de',19:'da',20:'de',21:'de',22:'de',23:'te'} as Record<number, string>)[Number(resetHour)] || 'da'
                            } o günün sayfası kapanır ve yeni bir sayfa açılır.
                        </p>

                        <p>
                            <span className="font-bold text-emerald-500 block mb-1">Farklı Zikirleri Takip Etme 📑</span>
                            Üstteki sekmelerden (butonlardan) farklı zikirler arasında geçiş yapabilirsiniz. Her zikrin hedefi ve günlük toplamı birbirinden bağımsız olarak tutulur.
                        </p>

                        <p>
                            <span className="font-bold text-emerald-500 block mb-1">Geçmiş Kayıtlar Korunur 🗄️</span>
                            Önceki günlerde okuduklarınız asla silinmez, hepsi tarihli olarak arşivde muhafaza edilir. Sadece sayaç yeni gün için sıfırdan başlar.
                        </p>

                        <p>
                            <span className="font-bold text-emerald-500 block mb-1">Düzeltme Yapmak İsterseniz ⚠️</span>
                            Yanlışlıkla fazla sayı girerseniz, eksili sayı (örneğin -100) girerek düzeltme yapabilirsiniz.
                        </p>

                        <p>
                            <span className="font-bold text-emerald-500 block mb-1">Kendi Adedim 👤</span>
                            Toplam sayının altındaki <strong>Kendi Adedim</strong> butonuna tıklayarak bugün sizin toplam kaç adet girdiğinizi görebilirsiniz.
                        </p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="mt-6 w-full py-3 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        Anladım, Teşekkürler
                    </button>

                </div>
            </motion.div>
        </AnimatePresence>
    );
}
