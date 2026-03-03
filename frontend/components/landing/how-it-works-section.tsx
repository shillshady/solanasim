import { UserPlus, Search, TrendingUp, BarChart2, Eye, Gift } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    title: "Sign up & connect",
    description: "Create your account and get virtual balance instantly (10 SOL for standard users, 100 SOL for SIM holders).",
  },
  {
    icon: Search,
    title: "Explore & track",
    description: "Browse trending tokens and track successful wallets to learn winning strategies.",
  },
  {
    icon: TrendingUp,
    title: "Place paper trades",
    description: "Buy and sell tokens with virtual SOL. Practice without risk.",
  },
  {
    icon: Gift,
    title: "Earn rewards",
    description: "Get rewarded for trading activity, daily streaks, and achievements.",
  },
  {
    icon: BarChart2,
    title: "Track & compete",
    description: "Monitor your portfolio stats and climb the leaderboard rankings.",
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-20 md:py-32 bg-foreground text-background border-t border-background/20">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <h2 className="font-heading text-4xl md:text-5xl font-bold">
            How It Works
          </h2>
          <p className="text-xl text-background/70 max-w-2xl mx-auto">
            Start trading, tracking, and earning in minutes. No wallet connection required.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-background/20" />

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5 relative">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Step number */}
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-background border-2 border-background flex items-center justify-center">
                      <step.icon className="h-9 w-9 text-foreground" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-9 w-9 rounded-full bg-[#00ff85] text-foreground border-2 border-foreground flex items-center justify-center text-base font-bold shadow-lg">
                      {index + 1}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-heading text-xl font-bold">{step.title}</h3>
                    <p className="text-base text-background/60 leading-relaxed max-w-xs">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
