// SPDX-License-Identifier: GPL-3.0-only
import type { Metadata, Viewport } from "next";
import { Noto_Serif, Noto_Sans, Noto_Sans_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getTheme } from "@/lib/theme";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { SWRegister } from "./sw-register";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  display: "swap",
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoMono = Noto_Sans_Mono({
  variable: "--font-noto-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#BB4F35" },
    { media: "(prefers-color-scheme: dark)", color: "#C17A5E" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Book Shelf",
    template: "%s | Book Shelf",
  },
  description:
    "Personal digital library experience — Track your books, lending history, reading goals and stats in a warm, calm, timeless interface. Noto Serif/Sans typography, Fine Porcelain/Burnt Ochre & Ink & Copper palette, equal-sized physical book cards and responsive shell.",
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Book Shelf",
  },
  openGraph: {
    title: "Book Shelf",
    description:
      "Personal digital library — warm, calm, timeless. Noto typography and Fine Porcelain/Ink-Copper palette with book cards.",
    type: "website",
    locale: "en_US",
    siteName: "Book Shelf",
  },
  twitter: {
    card: "summary",
    title: "Book Shelf",
    description: "Personal digital library — warm, calm, timeless.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getTheme();
  const locale = await getLocale();
  const dict = await getDictionary();
  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${notoSerif.variable} ${notoSans.variable} ${notoMono.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <SWRegister vapidPublicKey={process.env.VAPID_PUBLIC_KEY} />
        {children}
        <CookieConsent dict={dict.cookieConsent as never} />
        <Toaster />
      </body>
    </html>
  );
}
