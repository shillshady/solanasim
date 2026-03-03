/**
 * Token Radar Hub Page
 *
 * Token discovery hub showing bonded, graduating, and new tokens
 */

import { Metadata } from "next"
import { TokenRadarHub } from "@/components/token-radar/token-radar-hub"

export const metadata: Metadata = {
  title: "Token Radar | TestNet",
  description: "Discover new Solana tokens as they progress from new pairs to about to graduate to bonded. Track token health, liquidity, and migration status in real-time.",
  openGraph: {
    title: "Token Radar | TestNet",
    description: "Discover new Solana tokens in real-time. Watch tokens progress from new pairs to bonded curve.",
    images: ["/og-image.svg"],
  },
}

export default function TokenRadarPage() {
  return (
    <TokenRadarHub />
  )
}
