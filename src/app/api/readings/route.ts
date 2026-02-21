import { NextResponse } from 'next/server';
import { addReading, getDailyTotal, DynamicSettings } from '../../../lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// --- Cache + Dedup Layer ---
const CACHE_TTL_MS = 5000; // 5 saniye (User requested)
let cachedData: { total: number; date: string; userCounts: Record<string, number>; settings: DynamicSettings } | null = null;
let cacheTimestamp = 0;
let inflightRequest: Promise<{ total: number; date: string; userCounts: Record<string, number>; settings: DynamicSettings }> | null = null;

async function getCachedDailyTotal() {
    // 1. Cache hâlâ taze mi?
    if (cachedData && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) {
        return cachedData;
    }

    // 2. Dedup: Zaten devam eden bir istek var mı?
    if (inflightRequest) {
        return inflightRequest;
    }

    // 3. Yeni istek başlat ve paylaş
    inflightRequest = getDailyTotal()
        .then(data => {
            cachedData = data;
            cacheTimestamp = Date.now();
            return data;
        })
        .finally(() => {
            inflightRequest = null;
        });

    return inflightRequest;
}

export function invalidateCache() {
    cachedData = null;
    cacheTimestamp = 0;
}
// --- End Cache + Dedup Layer ---

export async function GET() {
    try {
        const data = await getCachedDailyTotal();
        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        const errMsg = error instanceof Error ? error.message : '';
        const isCredentialError = errMsg.includes('credentials are not set') || errMsg.includes('private key');
        return NextResponse.json({
            total: 0,
            date: new Date().toISOString().split('T')[0],
            settings: { target: 100000, resetHour: 22, dhikrName: 'İhlas-ı Şerif' },
            error: isCredentialError ? 'Setup Required' : 'Overloaded'
        }, { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, count, confirmCorrection } = body;
        let finalCount = parseInt(count, 10);

        if (!name || isNaN(finalCount)) {
            return NextResponse.json({ error: 'Name and count are required' }, { status: 400 });
        }

        // Max 10,000 per entry
        if (Math.abs(finalCount) > 10000) {
            return NextResponse.json({
                success: false,
                message: 'Tek seferde en fazla 10.000 girilebilir.'
            }, { status: 400 });
        }

        // SMART CORRECTION LOGIC
        // If the user is trying to subtract (negative count)
        if (finalCount < 0) {
            // Fetch current totals to check credit
            const { userCounts } = await getDailyTotal();
            const userCredit = userCounts[name] || 0;

            // If user has no credit, they can't subtract anything.
            if (userCredit <= 0) {
                return NextResponse.json({
                    success: false,
                    message: `Hata: ${name} ismine ait bugün okunmuş adet bulunamadı (veya bakiye 0). Çıkarma işlemi yapılamaz.`
                }, { status: 400 });
            }

            // If they try to subtract more than they have
            // Example: Credit=400, Request=-500.
            if (Math.abs(finalCount) > userCredit) {
                // If user hasn't confirmed yet, ask for confirmation
                if (!confirmCorrection) {
                    return NextResponse.json({
                        success: false,
                        message: `Dikkat: Toplamda ${userCredit} okumanız var, ${Math.abs(finalCount)} çıkarmaya çalışıyorsunuz.`,
                        requiresConfirmation: true,
                        maxSubtractable: userCredit
                    }, { status: 409 }); // 409 Conflict
                }

                // If confirmed, cap it at their total credit
                finalCount = -userCredit;
            }
        }

        await addReading(name, finalCount);
        invalidateCache(); // POST sonrası cache'i sıfırla → sonraki GET taze veri çeker
        return NextResponse.json({ success: true, adjusted: finalCount !== parseInt(count, 10) });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to add reading' }, { status: 500 });
    }
}
