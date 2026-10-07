import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WhatsApp Blaster - Professional Bulk Messaging",
  description: "Send bulk WhatsApp messages with ease. Upload contacts, customize messages, and reach your audience efficiently. Built with modern web technologies.",
  keywords: ["WhatsApp", "Bulk Messaging", "Marketing", "Communication", "WhatsApp Blaster", "Bulk Sender"],
  authors: [{ name: "WhatsApp Blaster Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "WhatsApp Blaster - Professional Bulk Messaging",
    description: "Send bulk WhatsApp messages with ease. Upload contacts, customize messages, and reach your audience efficiently.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsApp Blaster - Professional Bulk Messaging",
    description: "Send bulk WhatsApp messages with ease.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
