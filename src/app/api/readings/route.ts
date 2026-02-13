import { NextResponse } from 'next/server';
import { addReading, getDailyTotal } from '../../../lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const data = await getDailyTotal();
        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        // Return mock data if credentials are missing/invalid for demo purposes
        // Or just fail. The user needs to set up credentials.
        // For now, let's return a friendly error so the frontend doesn't crash completely
        return NextResponse.json({ total: 0, date: new Date().toISOString().split('T')[0], error: 'Setup Required' }, { status: 200 });
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
        return NextResponse.json({ success: true, adjusted: finalCount !== parseInt(count, 10) });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to add reading' }, { status: 500 });
    }
}
