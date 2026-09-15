import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://insightre.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ARIA — 재보험 중개 특화 AI 에이전트 | 트레져러",
  description:
    "리스크 요약·번역부터 영업 이메일 작성, 슬립 작성, 계약·클레임 관리까지 — 재보험 중개사의 반복 업무를 자동화하는 트레져러의 AI 에이전트 시스템 ARIA.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "ARIA by Treasurer",
    title: "ARIA — 재보험 중개 특화 AI 에이전트",
    description:
      "재보험 중개 실무를 위한 AI 에이전트. 리스크 요약·번역, 슬립 작성, 계약·클레임 관리, 파이프라인 대시보드까지.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-center" theme="light" />
      </body>
    </html>
  );
}
