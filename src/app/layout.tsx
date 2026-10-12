import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
import { AppShell } from "@/components/shell";
import { isAuthed } from "@/lib/auth";
import { getShell } from "@/lib/queries";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Pulse", template: "%s · Pulse" },
  description: "Account signals and outreach workspace — who to contact today, and why.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f9" },
  ],
};

export const dynamic = "force-dynamic";

// Applied before paint so there is no theme flash. Dark is the default.
const themeScript = `try{var t=localStorage.getItem('pulse-theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [authed, shell] = await Promise.all([isAuthed(), getShell()]);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MotionConfig reducedMotion="user">
          <AppShell authed={authed} accounts={shell.accounts} lastRun={shell.lastRun} safeMode={process.env.SAFE_MODE !== "false"}>
            {children}
          </AppShell>
        </MotionConfig>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line-strong)" },
          }}
        />
      </body>
    </html>
  );
}
