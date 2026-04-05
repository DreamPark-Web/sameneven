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
        <script dangerouslySetInnerHTML={{ __html: `(function(){var r=document.documentElement;var t=localStorage.getItem('se_theme');if(t==='dark'){r.setAttribute('data-theme','dark');r.style.backgroundColor='#121212';r.style.setProperty('--accent','#E8C49A');r.style.setProperty('--accent2','#EBCCA9');r.style.setProperty('--accent-rgb','232, 196, 154');}else{r.style.setProperty('--accent','#6366F1');r.style.setProperty('--accent2','#818CF8');r.style.setProperty('--accent-rgb','99, 102, 241');}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
