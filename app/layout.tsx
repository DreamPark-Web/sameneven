import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Get Clear",
  description: "Financieel overzicht voor iedereen die je vertrouwt",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" style={{ backgroundColor: '#EFEFEF', colorScheme: 'light' }} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#EFEFEF" />
        <title>Get Clear</title>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var r=document.documentElement;var t=localStorage.getItem('se_theme');if(t==='dark'){r.setAttribute('data-theme','dark');r.style.backgroundColor='#121212';r.style.setProperty('--accent','#818CF8');r.style.setProperty('--accent2','#A5B4FC');r.style.setProperty('--accent-rgb','129, 140, 248');}else{r.style.setProperty('--accent','#6366F1');r.style.setProperty('--accent2','#818CF8');r.style.setProperty('--accent-rgb','99, 102, 241');}})();` }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Get Clear" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
