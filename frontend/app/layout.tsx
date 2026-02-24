import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "MentorLed AI-Ops Platform",
  description: "AI-powered operations platform for MentorLed program management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4 focus:bg-white focus:dark:bg-gray-800 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-green-600 focus:font-medium">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
