import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Zikir Takip',
        short_name: 'Zikir Takip',
        description: 'Zikir Takip Uygulaması',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
            {
                src: '/icon.png?v=3',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    };
}
