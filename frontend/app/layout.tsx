import type React from "react"
import type { Metadata } from "next"
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import { NavBar } from "@/components/navigation/nav-bar"
import { BottomNavBar } from "@/components/navigation/bottom-nav-bar"
import { RealtimeTradeStrip } from "@/components/trading/realtime-trade-strip"
import { AppProviders } from "@/components/providers"

import "./globals.css"
import "./wallet-modal-override.css"

// Typography: IBM Plex Sans Bold for headings, Radnika Next for body
const radnikaNext = localFont({
  src: "./fonts/Radnika-Medium.otf",
  variable: "--font-radnika-next",
})
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-ibm-plex-sans",
})
// JetBrains Mono kept for code/monospace elements only
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "Solana Sim - Solana Paper Trading",
  description: "Practice Solana trading without risk. Real-time market data, zero financial risk.",
  icons: {
    icon: [
      { url: "/favicon-32x32.svg", sizes: "32x32", type: "image/svg+xml" },
      { url: "/solana-sim-logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.svg",
  },
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${radnikaNext.variable} ${ibmPlexSans.variable} ${jetBrainsMono.variable} font-sans`}
      >
        <AppProviders>
          <NavBar aria-label="Primary navigation" />
          <RealtimeTradeStrip
            className="fixed left-0 right-0 z-40 border-b bg-background"
            style={{ top: 'var(--navbar-height)' }}
            maxTrades={15}
          />
          <main
            className="min-h-screen"
            style={{
              paddingTop: 'calc(var(--navbar-height) + var(--trade-strip-height))',
              paddingBottom: 'var(--bottom-nav-height)'
            }}
            role="main"
          >
            {children}
          </main>
          <BottomNavBar aria-label="Mobile navigation" />
        </AppProviders>
      </body>
    </html>
  )
}
