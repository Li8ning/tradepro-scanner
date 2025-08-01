import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ChakraProvider } from "@chakra-ui/react";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TradePro Scanner - Professional Stock & Crypto Trend Analysis",
  description: "Advanced trading platform for real-time stock and cryptocurrency trend analysis. Track market movements, analyze trends, and make informed investment decisions.",
  keywords: "stock scanner, crypto scanner, trend analysis, trading platform, market analysis, investment tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ChakraProvider>
          {children}
        </ChakraProvider>
      </body>
    </html>
  );
}
