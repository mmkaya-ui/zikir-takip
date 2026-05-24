import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zikir Takip",
  description: "Günlük Zikir Okuma Takibi",
  icons: {
    icon: "/icon.png?v=3",
    apple: "/icon.png?v=3",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zikir Takip",
  },
};
export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

import ErrorBoundary from "./components/ErrorBoundary";
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="/icon.png?v=3" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png?v=3" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Fix for iOS PWA "unclickable inputs"
              document.addEventListener('touchstart', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                  // Allow the event to pass through to the input
                  e.target.focus();
                }
              }, { passive: false });
            `,
          }}
        />
      </head>
      <body className={outfit.className}>
        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
