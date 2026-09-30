import type { Metadata } from "next";
import { SupportModeBanner } from "@/components/support-mode/support-mode-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Appzex", template: "%s · Appzex" },
  description: "Multi-tenant project management for agencies and their clients.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SupportModeBanner />
        {children}
      </body>
    </html>
  );
}
