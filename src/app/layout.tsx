import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SITE_NAME } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site-url";

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
  // Every relative canonical and Open Graph URL below is resolved against this,
  // so it is the single place the public origin enters the metadata layer.
  metadataBase: getSiteUrl(),
  title: {
    // Pages set a bare name ("Shop") and inherit the suffix. `default` is what
    // the home page and any page without its own title render, kept as the
    // plain brand line rather than "Sombre | Sombre".
    default: "Sombre",
    template: "%s | Sombre",
  },
  description: "Curated luxury fragrances and lifestyle products.",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_HK",
  },
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
