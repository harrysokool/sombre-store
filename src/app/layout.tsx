import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for editorial headlines. Loaded globally so any page may opt in,
// but only applied where `font-display` is used, which today is the header
// wordmark and the home page. Every other page keeps rendering in Geist.
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sombre",
  description: "Curated luxury fragrances and lifestyle products.",
};

// Document shell only. The public navbar and footer belong to the
// `(storefront)` route group, so admin routes are not wrapped in shop chrome.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-stone-950 text-stone-100">
        {children}
      </body>
    </html>
  );
}
