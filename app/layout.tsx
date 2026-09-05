import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SCRIPT_TEMA } from "@/lib/tema";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Rapportini Taglio",
  description: "PWA offline per rapportini di taglio vegetazione su linee",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Rapportini Taglio",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c1f18",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${sans.variable} h-full`} suppressHydrationWarning>
      <body className="app-root">
        <Script id="tema-iniziale" strategy="beforeInteractive">
          {SCRIPT_TEMA}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
