import { NextResponse } from 'next/server';
import { addReading, getDailyTotal, Reading } from '../../../lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// --- Cache + Dedup Layer ---
const CACHE_TTL_MS = 5000; // 5 saniye (User feedback)
let cachedData: { total: number; date: string; userCounts: Record<string, number> } | null = null;
let cacheTimestamp = 0;
let inflightRequest: Promise<{ total: number; date: string; userCounts: Record<string, number> }> | null = null;

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
    // Optimistic updates logic prefers manual updates, but strict invalidation is still useful sometimes
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
        const isOverloaded = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests');

        return NextResponse.json({
            total: 0,
            date: new Date().toISOString().split('T')[0],
            error: isCredentialError ? 'Setup Required' : 'Overloaded' // Default to overloaded for safety
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

        // --- SMART CORRECTION LOGIC ---
        // If the user is trying to subtract (negative count)
        if (finalCount < 0) {

            // 1. Try Cache First (Fast Path)
            let currentCredit = 0;
            if (cachedData && cachedData.userCounts[name]) {
                currentCredit = cachedData.userCounts[name];
            } else {
                // 2. Cache Empty or Incomplete? Fetch Fresh (Safe Path)
                // This handles the case where user just added some, cache expired/missing, and they want to correct it.
                try {
                    const freshData = await getDailyTotal();
                    currentCredit = freshData.userCounts[name] || 0;
                    // Update cache while we are at it
                    cachedData = freshData;
                    cacheTimestamp = Date.now();
                } catch (e) {
                    // If fetch fails (overload), we can't safely verify credit. 
                    // Fail safe: assume 0 credit to prevent negative drift.
                    console.error("Failed to fetch fresh data for correction check", e);
                    currentCredit = 0;
                }
            }

            // If user has no credit, they can't subtract anything.
            if (currentCredit <= 0) {
                return NextResponse.json({
                    success: false,
                    message: `Hata: ${name} ismine ait bugün okunmuş adet bulunamadı (veya bakiye 0). Çıkarma işlemi yapılamaz.`
                }, { status: 400 });
            }

            // If they try to subtract more than they have
            // Example: Credit=400, Request=-500.
            if (Math.abs(finalCount) > currentCredit) {
                // If user hasn't confirmed yet, ask for confirmation
                if (!confirmCorrection) {
                    return NextResponse.json({
                        success: false,
                        message: `Dikkat: Toplamda ${currentCredit} okumanız var, ${Math.abs(finalCount)} çıkarmaya çalışıyorsunuz.`,
                        requiresConfirmation: true,
                        maxSubtractable: currentCredit
                    }, { status: 409 }); // 409 Conflict
                }

                // If confirmed, cap it at their total credit
                finalCount = -currentCredit;
            }
        }

        // --- WRITE TO SHEET ---
        await addReading(name, finalCount);

        // --- OPTIMISTIC CACHE UPDATE ---
        // Instead of processing invalidation, we update the in-memory cache
        // causing immediate reflection for subsequent GETs (until TTL expires)
        if (cachedData) {
            cachedData.total += finalCount;
            cachedData.userCounts[name] = (cachedData.userCounts[name] || 0) + finalCount;
            // Note: We do NOT reset cacheTimestamp, so this optimistic data 
            // lives only as long as the original fetch was valid (max 5s).
            // This ensures eventual consistency with the Sheet.
        } else {
            // If no cache existed, we don't manually create it to avoid 
            // complex edge cases (missing date, etc). 
            // Just let the next GET fetch it.
        }

        return NextResponse.json({
            success: true,
            adjusted: finalCount !== parseInt(count, 10),
            // Return updated totals for client to update immediately
            newTotal: cachedData?.total,
            newUserCount: cachedData?.userCounts[name]
        });
    } catch (error) {
        console.error(error);

        // Check for Rate Limits during POST
        const errMsg = error instanceof Error ? error.message : '';
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests')) {
            return NextResponse.json({
                success: false,
                message: 'Sistem çok yüklendi, birazdan tekrar deneyin ⏳'
            }, { status: 429 });
        }

        return NextResponse.json({ error: 'Failed to add reading' }, { status: 500 });
    }
}
