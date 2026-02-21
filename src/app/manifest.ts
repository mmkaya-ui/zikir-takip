import { MetadataRoute } from 'next';
import { getDoc, getSettings } from '../lib/googleSheets';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    let title = "Zikir Takip";
    try {
        const doc = await getDoc();
        const settings = await getSettings(doc);
        title = settings.dhikrName;
    } catch (e) {
        console.error("Manifest fetch error:", e);
    }

    return {
        name: title,
        short_name: title,
        description: `${title} Takip Uygulaması`,
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
            {
                src: '/icon.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    };
}
