import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NetScope — 通信可視化",
  description: "WireGuard VPN 経由の通信メタ情報ビューア",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${geistMono.variable} dark`}>
      <body className="font-mono bg-slate-950 text-slate-100 antialiased min-h-screen">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight"
            >
              <span className="text-blue-400 text-lg">⬡</span>
              <span>NetScope</span>
            </a>
            <nav className="flex gap-4 text-sm text-slate-400">
              <a href="/packets" className="hover:text-slate-100 transition-colors">
                通信一覧
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-screen-2xl mx-auto px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
