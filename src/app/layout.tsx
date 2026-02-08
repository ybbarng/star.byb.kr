import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const pretendard = localFont({
  src: "../ui/fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "star.byb.kr",
  description: "Find stars from Photo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://cdn.jsdelivr.net/npm/mathjs@14.0.1/lib/browser/math.js"
          strategy="beforeInteractive"
        />
        <Script id="mathjs-fallback" strategy="beforeInteractive">
          {`window.math||document.write('<script src="/libs/math.js"><\\/script>')`}
        </Script>
      </head>
      <body className={`${pretendard.className} h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
