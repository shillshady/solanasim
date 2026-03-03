import { Loader2, Radio } from "lucide-react"

export default function TokenRadarLoading() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 flex items-center justify-center border border-border bg-primary">
              <Radio className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="h-8 w-40 bg-muted animate-pulse mb-2"></div>
              <div className="h-4 w-64 bg-muted animate-pulse"></div>
            </div>
          </div>

          {/* Filter Bar Skeleton */}
          <div className="bg-card border border-border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-10 w-32 bg-muted animate-pulse"></div>
              <div className="h-10 w-32 bg-muted animate-pulse"></div>
              <div className="h-10 w-32 bg-muted animate-pulse"></div>
              <div className="h-10 w-24 bg-muted animate-pulse ml-auto"></div>
            </div>
          </div>
        </div>

        {/* Three Column Layout Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Column 1 - New Tokens */}
          <div className="bg-card border border-border">
            <div className="p-4 border-b border-border">
              <div className="h-6 w-32 bg-muted animate-pulse"></div>
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-5 w-24 bg-muted animate-pulse mb-2"></div>
                      <div className="h-3 w-16 bg-muted animate-pulse"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-5 w-16 bg-muted animate-pulse mb-2"></div>
                      <div className="h-3 w-12 bg-muted animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2 - Graduating */}
          <div className="bg-card border border-border">
            <div className="p-4 border-b border-border">
              <div className="h-6 w-36 bg-muted animate-pulse"></div>
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-5 w-24 bg-muted animate-pulse mb-2"></div>
                      <div className="h-3 w-16 bg-muted animate-pulse"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-5 w-16 bg-muted animate-pulse mb-2"></div>
                      <div className="h-3 w-12 bg-muted animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 - Bonded */}
          <div className="bg-card border border-border">
            <div className="p-4 border-b border-border">
              <div className="h-6 w-28 bg-muted animate-pulse"></div>
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-5 w-24 bg-muted animate-pulse mb-2"></div>
                      <div className="h-3 w-16 bg-muted animate-pulse"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-5 w-16 bg-muted animate-pulse mb-2"></div>
                      <div className="h-3 w-12 bg-muted animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center justify-center mt-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-mono text-sm uppercase tracking-wider">Scanning for tokens...</span>
          </div>
        </div>
      </main>
    </div>
  )
}
