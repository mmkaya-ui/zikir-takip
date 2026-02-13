import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'İhlas Takip';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
    // We can't easily load local fonts in edge without fetch, so we'll use standard fonts or fetch from Google.
    // For simplicity and reliability, we'll strive for a clean, code-drawn SVG-like design.

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'linear-gradient(to bottom right, #064E3B, #10B981)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                }}
            >
                {/* Background Pattern (Subtle) */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.1) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255, 255, 255, 0.1) 2%, transparent 0%)',
                    backgroundSize: '100px 100px',
                    opacity: 0.3,
                }}></div>

                {/* Icon (Simplified Rub el Hizb) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 150,
                    height: 150,
                    marginBottom: 40,
                    position: 'relative',
                }}>
                    {/* We draw the star using rotated squares manually since we can't import svg directly easily here */}
                    <div style={{
                        position: 'absolute',
                        width: 140,
                        height: 140,
                        border: '8px solid #FCD34D', // Gold
                        borderRadius: 20,
                        transform: 'rotate(45deg)',
                        background: 'rgba(255, 255, 255, 0.05)',
                    }}></div>
                    <div style={{
                        position: 'absolute',
                        width: 140,
                        height: 140,
                        border: '8px solid #FCD34D', // Gold
                        borderRadius: 20,
                        transform: 'rotate(0deg)',
                        background: 'rgba(255, 255, 255, 0)',
                    }}></div>
                    <div style={{
                        width: 40,
                        height: 40,
                        background: '#FCD34D',
                        borderRadius: '50%',
                    }}></div>
                </div>

                <div style={{
                    fontSize: 80,
                    fontWeight: 900,
                    color: 'white',
                    marginBottom: 20,
                    textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    letterSpacing: '-2px',
                }}>
                    İHLAS TAKİP
                </div>

                <div style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: '#FCD34D', // Gold
                    letterSpacing: '4px',
                    textTransform: 'uppercase',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '10px 30px',
                    borderRadius: 50,
                }}>
                    Günlük Okuma & Hatim
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
