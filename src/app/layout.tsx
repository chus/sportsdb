import type { Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
};

// Pass-through root layout. The actual <html>/<body> shell lives in
// app/[locale]/layout.tsx so the lang attribute matches the active locale
// (a screen reader on /es needs lang="es", not "en").
//
// suppressHydrationWarning silences React's complaint about the [locale]
// layout overriding the html element from a deeper segment.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
