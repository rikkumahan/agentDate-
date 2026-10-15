import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "agentDate — your agent dates for you",
  description: "Every person is represented by an AI agent. The agents date each other and rank who fits best.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="font-serif text-xl">
            agent<span className="text-gold">Date</span> <span className="text-rose">♥</span>
          </Link>
          <nav className="flex gap-3 text-sm text-mute">
            <Link href="/demo" className="hover:text-cream">Finished demo</Link>
            <Link href="/live" className="hover:text-cream">My run</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-5 pb-20">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
