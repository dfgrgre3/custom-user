import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavTabs } from "@/components/nav-tabs";
import { SystemStatus } from "@/components/system-status";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Customer User Sync",
  description: "Synchronized users from the customer API, stored and served from our own database.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`}>
      {/* Browser extensions may add attributes to <body> before React hydrates. */}
      <body
        suppressHydrationWarning
        className="min-h-full bg-background text-foreground antialiased"
      >
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Operations</p>
              <h1 className="text-2xl font-semibold tracking-tight">Customer User Sync</h1>
              <p className="mt-1.5 max-w-xl text-sm text-muted">
                Synchronized users, stored locally and served from our own database.
              </p>
            </div>
            <SystemStatus />
          </header>
          <NavTabs />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
