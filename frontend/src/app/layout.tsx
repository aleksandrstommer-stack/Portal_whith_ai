import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { ChatLauncher } from "@/components/chat-launcher";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Корпоративный портал",
    template: "%s · Корпоративный портал",
  },
  description: "Новости, документы, люди и сервисы компании в едином интерфейсе.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased selection:bg-primary/20 selection:text-foreground">
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <ChatLauncher />
      </body>
    </html>
  );
}
