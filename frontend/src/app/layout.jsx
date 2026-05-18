import { Toaster } from 'react-hot-toast';
import AppShell from '../components/common/AppShell';
import ServiceWorkerRegistrar from '../components/pwa/ServiceWorkerRegistrar';
import InstallPrompt from '../components/pwa/InstallPrompt';
import './globals.css';

export const metadata = {
  title: 'Walk Up & Talk — Free Dating App',
  description: 'Real connections. 100% free. Call your match within 7 days.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Walk Up & Talk',
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: '#ec4899',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA meta tags */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Walk Up & Talk" />

        {/* AdSense — only loads in production with a real publisher ID */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT &&
          !process.env.NEXT_PUBLIC_ADSENSE_CLIENT.includes('XXXX') && (
            <script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
            />
          )}
      </head>
      <body className="bg-gray-50 font-sans antialiased">
        <ServiceWorkerRegistrar />
        <AppShell>
          {children}
        </AppShell>
        <InstallPrompt />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '12px', fontWeight: '500' },
          }}
        />
      </body>
    </html>
  );
}
