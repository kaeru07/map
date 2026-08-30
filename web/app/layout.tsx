import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// このアプリは2つの用途が同居している（2026-08-31 統合時に確認）:
//   /         → グアム旅行の地図アプリ（GuamTripApp）
//   /packets  → NetScope（パケット解析）。分析・比較画面はこちらの配下
// layout は上位共通なのでグアム側のメタデータを維持し、NetScope 用の導線は
// /packets 配下の画面（FilterBar など）に置く。
export const metadata: Metadata = {
  title: "Guam Trip Map",
  description: "The Tsubaki Tower起点のグアム旅行インタラクティブ地図",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Guam Map",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

