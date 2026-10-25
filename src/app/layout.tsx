import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/env";

import "./globals.css";

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "WhicHOne",
    template: "%s | WhicHOne",
  },
  description: "다른 사람들은 어떻게 생각할까? 가벼운 질문에 투표하고 선택 비율과 이유를 확인하세요.",
  openGraph: {
    title: "WhicHOne",
    description: "다른 사람들은 어떻게 생각할까?",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${noto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-card focus:px-3 focus:py-2"
        >
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <main id="content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
