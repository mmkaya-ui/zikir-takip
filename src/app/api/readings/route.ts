import { NextResponse } from 'next/server';
import { addReading, getDailyTotal, Reading } from '../../../lib/googleSheets';
import { redis } from '../../../lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// --- Hybrid Logic Helpers ---

// Get Effective Date (YYYY-MM-DD) - Same logic as Google Sheets to keep them in sync
function getEffectiveDate(): string {
    const trtNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
    if (trtNow.getHours() >= 22) {
        trtNow.setDate(trtNow.getDate() + 1);
    }
    const year = trtNow.getFullYear();
    const month = String(trtNow.getMonth() + 1).padStart(2, '0');
    const day = String(trtNow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function getFromRedis() {
    const date = getEffectiveDate();
    const totalKey = `ihlas:${date}:total`;

    // Pipeline for speed
    const p = redis.pipeline();
    p.get(totalKey);
    // User counts are stored in a Hash for this date
    p.hgetall(`ihlas:${date}:users`);

    const [total, userCounts] = await p.exec() as [number | null, Record<string, number> | null];

    return {
        total: total || 0,
        date,
        userCounts: userCounts || {}
    };
}

export async function GET() {
    try {
        // 1. Try Redis First (Speed)
        try {
            const data = await getFromRedis();
            return NextResponse.json(data);
        } catch (redisError) {
            console.error("Redis Down/Limit:", redisError);
            // 2. Fallback to Google Sheets (Circuit Breaker)
            const data = await getDailyTotal();
            return NextResponse.json(data);
        }
    } catch (error) {
        console.error(error);
        const errMsg = error instanceof Error ? error.message : '';
        // If even Google Sheets fails
        return NextResponse.json({
            total: 0,
            date: new Date().toISOString().split('T')[0],
            error: 'Overloaded'
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
        if (Math.abs(finalCount) > 10000) {
            return NextResponse.json({ success: false, message: 'Tek seferde en fazla 10.000 girilebilir.' }, { status: 400 });
        }

        const date = getEffectiveDate();

        // --- SMART CORRECTION (Combined Redis + Fallback) ---
        if (finalCount < 0) {
            let currentCredit = 0;

            try {
                // Try Redis Credit
                const userCredit = await redis.hget(`ihlas:${date}:users`, name) as number | null;
                currentCredit = userCredit || 0;

                // If Redis has 0/null, it might be expired or empty. 
                // We could verify with Sheets if we wanted to be 100% safe, 
                // but for speed we'll trust Redis for now OR fallback if Redis throws.
            } catch (e) {
                // Redis failed, check Sheets
                const fresh = await getDailyTotal();
                currentCredit = fresh.userCounts[name] || 0;
            }

            if (currentCredit <= 0) {
                return NextResponse.json({
                    success: false,
                    message: `Hata: ${name} ismine ait bugün okunmuş adet bulunamadı (veya bakiye 0).`
                }, { status: 400 });
            }

            if (Math.abs(finalCount) > currentCredit) {
                if (!confirmCorrection) {
                    return NextResponse.json({
                        success: false,
                        message: `Dikkat: Toplamda ${currentCredit} okumanız var, ${Math.abs(finalCount)} çıkarmaya çalışıyorsunuz.`,
                        requiresConfirmation: true,
                        maxSubtractable: currentCredit
                    }, { status: 409 });
                }
                finalCount = -currentCredit;
            }
        }

        // --- WRITE STRATEGY ---
        try {
            // 1. Write to Redis (Realtime)
            const p = redis.pipeline();
            // Global Total
            p.incrby(`ihlas:${date}:total`, finalCount);
            // User Total (Hash)
            p.hincrby(`ihlas:${date}:users`, name, finalCount);
            // Queue for Sync (List) - Store full entry
            const entry = {
                name,
                count: finalCount,
                date,
                timestamp: new Date().toISOString()
            };
            p.rpush('ihlas:sync_queue', JSON.stringify(entry));

            // Execute
            const [newTotal, newUserCount] = await p.exec() as [number, number, number];

            // 2. Return Instant Success
            return NextResponse.json({
                success: true,
                adjusted: finalCount !== parseInt(count, 10),
                newTotal,
                newUserCount
            });

        } catch (redisError) {
            console.error("Redis Write Failed, switching to fallback:", redisError);

            // 3. Fallback: Direct Write to Sheets (Slow but reliable)
            await addReading(name, finalCount);

            // We return a generic success. 
            // We can't return newTotal/newUserCount easily without another slow fetch, 
            // so frontend will just have to wait for next poll or use its own local optimistic state (which it does!).
            return NextResponse.json({
                success: true,
                adjusted: finalCount !== parseInt(count, 10)
                // No returned totals signals frontend to just wait or simple increment
            });
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to add reading' }, { status: 500 });
    }
}
