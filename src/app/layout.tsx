import type { Metadata, Viewport } from "next";
import "@fontsource/graduate/latin-400.css";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: { default: "Tripdub · Daily hoops", template: "%s · Tripdub" },
  description: "Three daily games for hoops heads: Starting Five, NBA Trivia, and Shot Chart. Play solo or go 1v1.",
};

export const viewport: Viewport = {
  themeColor: "#9bc7ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
