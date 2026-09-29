// SPDX-License-Identifier: GPL-3.0-only
import type { Metadata, Viewport } from "next";
import { Noto_Serif, Noto_Sans, Noto_Sans_Mono, Noto_Sans_Arabic } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getResolvedTheme } from "@/lib/theme";
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

// v3.13.0 — Arabic glyphs for the RTL locale: Noto Sans Arabic covers the
// UI text; Noto Kufi-style serif headers come from the same family's design.
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  display: "swap",
});

// v3.11.0 — the title/status-bar color follows the app's actual theme (the
// theme cookie), not the raw OS preference: a pinned dark theme must show the
// dark title bar even in a light-mode OS, and vice versa. "system" (no/absent
// pin) keeps the media-query pair so the bar follows the OS like the app does.
export async function generateViewport(): Promise<Viewport> {
  const theme = await getResolvedTheme();
  const themeColor =
    theme === "dark"
      ? "#C17A5E"
      : theme === "light"
        ? "#BB4F35"
        : [
            { media: "(prefers-color-scheme: light)", color: "#BB4F35" },
            { media: "(prefers-color-scheme: dark)", color: "#C17A5E" },
          ];
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
    themeColor,
  };
}

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
  const theme = await getResolvedTheme();
  const locale = await getLocale();
  const dict = await getDictionary();
  // v3.13.0 — Arabic flows right-to-left; all other locales keep LTR.
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <html
      lang={locale}
      dir={dir}
      data-scroll-behavior="smooth"
      className={`${notoSerif.variable} ${notoSans.variable} ${notoMono.variable} ${notoSansArabic.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}
    >
      <head>
        {/* v3.12.2 — declare the page's color scheme to the rendering engine
            (Chromium + Gecko): pinned light → "light", pinned dark → "dark",
            system → "light dark" (the UA decides until our script applies the
            class). Engines that honor a declared color-scheme skip their own
            forced-dark inversion — the root cause of the broken light theme
            seen on phones in system dark mode. */}
        <meta name="color-scheme" content={theme === "dark" ? "dark" : theme === "light" ? "light" : "light dark"} />
        {/* v3.11.1 — "system" theme only: resolve the OS prefers-color-scheme
            before first paint (no flash) and keep following it live; also sync
            the meta theme-color so the PWA title/status bar matches the app.
            Pinned light/dark themes must NOT get this script — the server-set
            class is authoritative, otherwise the OS preference overrides the
            user's pin on every load (seen as "mobile light mode shows dark").
            Inline <script> does not re-execute on client-side navigations, so
            Settings does a full reload when the theme changes. */}
        {theme === undefined && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var d=m.matches;var c=document.documentElement.classList;c.toggle("dark",d);var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",d?"#C17A5E":"#BB4F35");}if(m.addEventListener)m.addEventListener("change",a);a();})();`,
            }}
          />
        )}
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
