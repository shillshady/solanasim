import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-20 md:py-32 bg-foreground text-background">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden p-12 md:p-16 text-center space-y-8">
          <div className="space-y-4">
            <h2 className="font-heading text-4xl md:text-5xl font-bold">
              Ready to start trading without risk?
            </h2>
            <p className="text-xl text-background/70 max-w-2xl mx-auto">
              Join traders practicing with Solana Sim. Track wallets, earn rewards, and compete on leaderboards - all risk-free.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/trade">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-background text-foreground hover:bg-background/90"
              >
                Start Trading Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-background text-background hover:bg-background hover:text-foreground">
                View Documentation
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
