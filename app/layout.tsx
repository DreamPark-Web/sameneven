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
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}