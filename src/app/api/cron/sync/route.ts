import { NextResponse } from 'next/server';
import { redis } from '../../../../lib/redis';
import { getSheet, getEffectiveDate } from '../../../../lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // 1. Authenticate (Cron Secret)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 2. Pop from Queue (Batch Size: 100)
        // LPOP count is supported in newer Redis, but Upstash REST creates a pipeline for safety
        const BATCH_SIZE = 100;
        const rawEntries = await redis.lpop('ihlas:sync_queue', BATCH_SIZE);

        if (!rawEntries || rawEntries.length === 0) {
            return NextResponse.json({ message: 'Queue empty', syncCount: 0 });
        }

        // 3. Parse Entries
        // rawEntries might be a single string or array of strings depending on client version/response
        const entries = (Array.isArray(rawEntries) ? rawEntries : [rawEntries])
            .map((e: string) => JSON.parse(e));

        if (entries.length === 0) return NextResponse.json({ message: 'No valid entries', syncCount: 0 });

        // 4. Batch Write to Sheets
        const sheet = await getSheet();

        // Prepare rows
        const rows = entries.map((e: any) => ({
            'Tarih': `'${e.date}`, // Force string format
            'İsim': e.name,
            'Adet': e.count,
            'Zaman': e.timestamp
        }));

        await sheet.addRows(rows);

        return NextResponse.json({
            success: true,
            message: `Synced ${entries.length} items`,
            syncCount: entries.length
        });

    } catch (error) {
        console.error("Cron Job Failed:", error);
        // If it fails, we LOST the popped items from Redis if we don't handle it carefully.
        // For this MVP, we log it. A production version would use RPOPLPUSH (reliable queue).
        // Since we are using LPOP, we rely on the script succeeding.
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
