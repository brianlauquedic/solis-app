import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solis — Solana AI 财务顾问",
  description: "连接你与 Solana DeFi 生态的智能大脑",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
