import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./(common)/Header";
import Footer from "./(common)/Footer";
import { Providers } from "./providers";
import { MuiThemeProvider } from "./theme-provider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { auth } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Total logger",
  description: "Log everything you do",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'light';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else if (theme === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) {
                      document.documentElement.classList.add('dark');
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <ThemeProvider>
          <MuiThemeProvider>
            <Providers session={session}>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </Providers>
          </MuiThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
