import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import { cn } from "@/lib/utils";

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "KNOT Procurement",
  description: "Procurement dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", geistSans.variable, geistMono.variable)}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster
          position="bottom-right"
          richColors={false}
          closeButton
          duration={4000}
          toastOptions={{
            classNames: {
              toast: "ds-toast",
            },
          }}
        />
      </body>
    </html>
  );
}
