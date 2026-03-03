import { Loader2, Settings } from "lucide-react"

export default function ProfileSettingsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex items-center justify-center border border-border bg-primary">
              <Settings className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="h-8 w-48 bg-muted animate-pulse mb-2"></div>
              <div className="h-4 w-72 bg-muted animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Profile Section Skeleton */}
        <div className="bg-card border border-border p-6 mb-6">
          <div className="h-6 w-32 bg-muted animate-pulse mb-6"></div>

          <div className="flex items-start gap-6">
            {/* Avatar Skeleton */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-24 w-24 rounded-full bg-muted animate-pulse"></div>
              <div className="h-9 w-28 bg-muted animate-pulse"></div>
            </div>

            {/* Form Fields Skeleton */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="h-4 w-20 bg-muted animate-pulse mb-2"></div>
                <div className="h-10 w-full bg-muted animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 w-16 bg-muted animate-pulse mb-2"></div>
                <div className="h-10 w-full bg-muted animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 w-12 bg-muted animate-pulse mb-2"></div>
                <div className="h-20 w-full bg-muted animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings Skeleton */}
        <div className="bg-card border border-border p-6 mb-6">
          <div className="h-6 w-40 bg-muted animate-pulse mb-6"></div>

          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <div className="h-5 w-32 bg-muted animate-pulse mb-2"></div>
                  <div className="h-3 w-48 bg-muted animate-pulse"></div>
                </div>
                <div className="h-6 w-11 bg-muted animate-pulse rounded-full"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Settings Skeleton */}
        <div className="bg-card border border-border p-6 mb-6">
          <div className="h-6 w-36 bg-muted animate-pulse mb-6"></div>

          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <div className="h-5 w-28 bg-muted animate-pulse mb-2"></div>
                  <div className="h-3 w-44 bg-muted animate-pulse"></div>
                </div>
                <div className="h-6 w-11 bg-muted animate-pulse rounded-full"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button Skeleton */}
        <div className="flex justify-end">
          <div className="h-10 w-32 bg-muted animate-pulse"></div>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center justify-center mt-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-mono text-sm uppercase tracking-wider">Loading settings...</span>
          </div>
        </div>
      </main>
    </div>
  )
}
