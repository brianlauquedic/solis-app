import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Sakura · 数学で画定する、AI エージェントの実行境界",
  description: "AI エージェントの実行境界を、運営側の誓約ではなく、数学で画定する。ユーザーが一度意図に署名すれば、エージェントのあらゆる動作は、Solana のオンチェーン検証を通過してはじめて、チェーンに刻まれる。圏外は、運営側の信頼ではなく、可能性として成立しない。",
  metadataBase: new URL("https://www.sakuraaai.com"),
  openGraph: {
    title: "Sakura · 数学で画定する、AI エージェントの実行境界",
    description: "AI エージェントの実行境界を、運営側の誓約ではなく、数学で画定する。ユーザーが一度意図に署名すれば、エージェントのあらゆる動作は、Solana のオンチェーン検証を通過してはじめて、チェーンに刻まれる。圏外は、運営側の信頼ではなく、可能性として成立しない。",
    url: "https://www.sakuraaai.com",
    siteName: "Sakura",
    locale: "ja_JP",
    type: "website",
    images: [
      {
        url: "/og-sakura.png",
        width: 1200,
        height: 630,
        alt: "Sakura · 数学で画定する、AI エージェントの実行境界",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sakura · 数学で画定する、AI エージェントの実行境界",
    description: "AI エージェントの実行境界を、運営側の誓約ではなく、数学で画定する。ユーザーが一度意図に署名すれば、エージェントのあらゆる動作は、Solana のオンチェーン検証を通過してはじめて、チェーンに刻まれる。圏外は、運営側の信頼ではなく、可能性として成立しない。",
    images: ["/og-sakura.png"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={cn("h-full", "font-sans", geist.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;500;700&family=Noto+Sans+JP:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
