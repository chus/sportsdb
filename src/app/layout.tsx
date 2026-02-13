import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: {
    default: "SportsDB — The International Sports Database",
    template: "%s | SportsDB",
  },
  description:
    "The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data.",
  openGraph: {
    type: "website",
    siteName: "SportsDB",
    title: "SportsDB — The International Sports Database",
    description:
      "The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
