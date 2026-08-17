import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { DbBootstrap } from "@/components/db-bootstrap";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Marsky — one list, two people, zero nagging",
  description:
    "Marsky: a shared reminder list for two. Pair in seconds, remind each other, check in together.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeBootstrap />
        <DbBootstrap />
        {children}
      </body>
    </html>
  );
}
