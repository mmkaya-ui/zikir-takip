import { redis } from '../../../../lib/redis';
import { getDailyTotal } from '../../../../lib/googleSheets';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Fetch current truth from Sheets
        const { total, date, userCounts } = await getDailyTotal();

        console.log(`Seeding Redis for ${date}... Total: ${total}`);

        // 2. Write to Redis
        const p = redis.pipeline();

        // Seed Global Total
        // set() overwrites, ensuring we match Sheets exactly
        p.set(`ihlas:${date}:total`, total);

        // Seed User Counts
        if (Object.keys(userCounts).length > 0) {
            // hmset is deprecated in some clients, hset is preferred
            p.hset(`ihlas:${date}:users`, userCounts);
        }

        await p.exec();

        return NextResponse.json({
            success: true,
            message: 'Redis seeded successfully',
            seededData: { total, date, userCount: Object.keys(userCounts).length }
        });

    } catch (error) {
        console.error("Seeding Failed:", error);
        return NextResponse.json({ error: 'Seeding failed' }, { status: 500 });
    }
}
