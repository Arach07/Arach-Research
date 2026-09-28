import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Research",
  description: "Codzienne raporty: giełda, złoto, krypto i ostrzeżenia przed scamami",
  appleWebApp: { capable: true, title: "Research", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07070a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="app-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
