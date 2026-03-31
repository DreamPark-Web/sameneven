import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Samen Even",
  description: "Financieel overzicht voor iedereen die je vertrouwt",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" style={{ backgroundColor: '#0F0F0F', colorScheme: 'dark' }} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0F0F0F" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var r=document.documentElement;var t=localStorage.getItem('se_theme');if(t==='light'){r.setAttribute('data-theme','light');}else{r.style.setProperty('--accent','#E8C49A');r.style.setProperty('--accent2','#EBCCA9');r.style.setProperty('--accent-rgb','232, 196, 154');}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}