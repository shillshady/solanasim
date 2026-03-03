"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { PurchaseModal } from '@/components/modals/purchase-modal'
import { PurchaseHistoryTable } from '@/components/purchase/purchase-history'
import {
  User,
  Mail,
  Lock,
  Upload,
  Trash2,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Camera,
  Settings,
  Shield,
  Bell,
  DollarSign,
  Globe,
  MessageSquare,
  Wallet,
  ShoppingCart
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import * as api from '@/lib/api'
import { errorLogger } from '@/lib/error-logger'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Settings data structure
type UserSettings = {
  notifications: {
    email: boolean
    browser: boolean
    trading: boolean
    portfolio: boolean
  }
  privacy: {
    publicProfile: boolean
    showBalance: boolean
    showTrades: boolean
  }
  trading: {
    confirmTrades: boolean
    defaultSlippage: number
    autoRefresh: boolean
  }
}

function UserSettingsPage() {
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Purchase modal state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)

  // States for form data
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [profileData, setProfileData] = useState({
    handle: '',
    bio: '',
    displayName: '',
    website: '',
    twitter: '',
    discord: '',
    telegram: ''
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [settingsData, setSettingsData] = useState<UserSettings>({
    notifications: {
      email: true,
      browser: false,
      trading: true,
      portfolio: true
    },
    privacy: {
      publicProfile: true,
      showBalance: false,
      showTrades: false
    },
    trading: {
      confirmTrades: true,
      defaultSlippage: 1.0,
      autoRefresh: true
    }
  })

  // Fetch user profile data
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: () => user?.id ? api.getUserProfile(user.id) : null,
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  // Initialize form data when user profile loads
  useEffect(() => {
    if (userProfile) {
      const profile = userProfile as any
      setProfileData({
        handle: profile.handle || '',
        bio: profile.bio || '',
        displayName: profile.displayName || '',
        website: profile.website || '',
        twitter: profile.twitter || '',
        discord: profile.discord || '',
        telegram: profile.telegram || ''
      })
    }
  }, [userProfile])

  // Load settings from localStorage (or could be from API)
  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettingsData(parsed)
      } catch (e) {
        errorLogger.error('Failed to parse saved settings', { component: 'UserSettingsPage' })
      }
    }
  }, [])

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      if (!user?.id) throw new Error('User not authenticated')
      return api.updateProfile({
        userId: user.id,
        username: data.handle || undefined, // UI "Username" field maps to username in DB
        handle: data.handle || undefined,
        bio: data.bio || undefined,
        displayName: data.displayName || undefined
      })
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
      // Force immediate refetch by invalidating and refetching
      await queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id], refetchType: 'active' })
      await queryClient.refetchQueries({ queryKey: ['userProfile', user?.id] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      })
    }
  })

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (passwordData.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
      if (!passwordRegex.test(passwordData.newPassword)) {
        throw new Error('Password must contain uppercase, lowercase, and number')
      }

      return api.changePassword({
        userId: user.id,
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully. Please log in again.",
      })
      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive"
      })
    }
  })

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('User not authenticated')

      // Validate file
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error('Please upload a JPEG, PNG, or WebP image')
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size must be less than 5MB')
      }

      // Convert to base64 (in production, upload to cloud storage)
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = async () => {
          try {
            const avatarUrl = reader.result as string
            await api.updateAvatar({ userId: user.id, avatarUrl })
            resolve(avatarUrl)
          } catch (err: any) {
            reject(err)
          }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Avatar updated successfully",
      })
      // Force immediate refetch by invalidating and refetching
      await queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id], refetchType: 'active' })
      await queryClient.refetchQueries({ queryKey: ['userProfile', user?.id] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar",
        variant: "destructive"
      })
    }
  })

  // Remove avatar mutation
  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      return api.removeAvatar(user.id)
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Avatar removed successfully",
      })
      // Force immediate refetch by invalidating and refetching
      await queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id], refetchType: 'active' })
      await queryClient.refetchQueries({ queryKey: ['userProfile', user?.id] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove avatar",
        variant: "destructive"
      })
    }
  })

  // Handle avatar file selection
  const handleAvatarUpload = useCallback(async (file: File) => {
    if (file) {
      uploadAvatarMutation.mutate(file)
    }
  }, [uploadAvatarMutation])

  // Save settings to localStorage
  const handleSettingsUpdate = useCallback(() => {
    try {
      localStorage.setItem('userSettings', JSON.stringify(settingsData))
      toast({
        title: "Success",
        description: "Settings saved successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      })
    }
  }, [settingsData, toast])

  if (!isAuthenticated || !user) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">Please log in to access settings</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const profile = userProfile as any
  const displayEmail = profile?.email || user?.email || ''
  const displayHandle = profile?.handle || (user as any)?.handle || ''
  const avatarUrl = profile?.avatarUrl || profile?.profileImage || (user as any)?.profileImage

  return (
    <div className="container max-w-4xl mx-auto py-8 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your profile and preferences</p>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Profile Picture
          </CardTitle>
          <CardDescription>Update your avatar image</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24 border-2 border-border">
              <AvatarImage src={avatarUrl} alt={displayHandle || 'User'} />
              <AvatarFallback className="text-2xl bg-muted">
                {displayHandle?.[0]?.toUpperCase() || displayEmail?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatarMutation.isPending}
                  size="sm"
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadAvatarMutation.isPending ? 'Uploading...' : 'Upload New'}
                </Button>
                {avatarUrl && (
                  <Button
                    onClick={() => removeAvatarMutation.mutate()}
                    disabled={removeAvatarMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {removeAvatarMutation.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                JPEG, PNG, or WebP. Max 5MB.
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_FILE_TYPES.join(',')}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleAvatarUpload(file)
            }}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => {
            e.preventDefault()
            updateProfileMutation.mutate(profileData)
          }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">@</span>
                  <Input
                    id="username"
                    value={profileData.handle}
                    onChange={(e) => setProfileData(prev => ({ ...prev, handle: e.target.value }))}
                    placeholder="username"
                    maxLength={30}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Your unique handle</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={displayEmail}
                  disabled
                  className="bg-muted opacity-60"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={profileData.displayName}
                onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Your display name"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                This is how your name appears on the leaderboard
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profileData.bio}
                onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                maxLength={500}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {profileData.bio.length}/500 characters
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Social Links</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    value={profileData.website}
                    onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    X (Twitter)
                  </Label>
                  <Input
                    id="twitter"
                    value={profileData.twitter}
                    onChange={(e) => setProfileData(prev => ({ ...prev, twitter: e.target.value }))}
                    placeholder="@username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discord" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Discord
                  </Label>
                  <Input
                    id="discord"
                    value={profileData.discord}
                    onChange={(e) => setProfileData(prev => ({ ...prev, discord: e.target.value }))}
                    placeholder="username#1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegram" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Telegram
                  </Label>
                  <Input
                    id="telegram"
                    value={profileData.telegram}
                    onChange={(e) => setProfileData(prev => ({ ...prev, telegram: e.target.value }))}
                    placeholder="@username"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Change your password and manage security</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => {
            e.preventDefault()
            changePasswordMutation.mutate()
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm new password"
                minLength={8}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be 8+ characters with uppercase, lowercase, and number
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending || !passwordData.currentPassword || !passwordData.newPassword}
              >
                <Lock className="h-4 w-4 mr-2" />
                {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* App Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferences
          </CardTitle>
          <CardDescription>Customize your app experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notifications */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h4>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={settingsData.notifications.email}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, email: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="browser-notifications">Browser Notifications</Label>
                  <p className="text-xs text-muted-foreground">Show notifications in browser</p>
                </div>
                <Switch
                  id="browser-notifications"
                  checked={settingsData.notifications.browser}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, browser: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="trading-notifications">Trading Alerts</Label>
                  <p className="text-xs text-muted-foreground">Alerts for trades and price changes</p>
                </div>
                <Switch
                  id="trading-notifications"
                  checked={settingsData.notifications.trading}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, trading: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="portfolio-notifications">Portfolio Updates</Label>
                  <p className="text-xs text-muted-foreground">Notifications about your portfolio</p>
                </div>
                <Switch
                  id="portfolio-notifications"
                  checked={settingsData.notifications.portfolio}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, portfolio: checked }
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Privacy */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Privacy
            </h4>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="public-profile">Public Profile</Label>
                  <p className="text-xs text-muted-foreground">Allow others to view your profile</p>
                </div>
                <Switch
                  id="public-profile"
                  checked={settingsData.privacy.publicProfile}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, publicProfile: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-balance">Show Balance</Label>
                  <p className="text-xs text-muted-foreground">Display your balance on public profile</p>
                </div>
                <Switch
                  id="show-balance"
                  checked={settingsData.privacy.showBalance}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, showBalance: checked }
                    }))
                  }
                  disabled={!settingsData.privacy.publicProfile}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-trades">Show Trading Activity</Label>
                  <p className="text-xs text-muted-foreground">Display recent trades on profile</p>
                </div>
                <Switch
                  id="show-trades"
                  checked={settingsData.privacy.showTrades}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, showTrades: checked }
                    }))
                  }
                  disabled={!settingsData.privacy.publicProfile}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Trading Preferences */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Trading
            </h4>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="confirm-trades">Confirm Trades</Label>
                  <p className="text-xs text-muted-foreground">Show confirmation dialog before executing trades</p>
                </div>
                <Switch
                  id="confirm-trades"
                  checked={settingsData.trading.confirmTrades}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      trading: { ...prev.trading, confirmTrades: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-refresh">Auto Refresh</Label>
                  <p className="text-xs text-muted-foreground">Automatically refresh portfolio and prices</p>
                </div>
                <Switch
                  id="auto-refresh"
                  checked={settingsData.trading.autoRefresh}
                  onCheckedChange={(checked) =>
                    setSettingsData(prev => ({
                      ...prev,
                      trading: { ...prev.trading, autoRefresh: checked }
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-slippage">Default Slippage (%)</Label>
                <Input
                  id="default-slippage"
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={settingsData.trading.defaultSlippage}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value) && value >= 0.1 && value <= 50) {
                      setSettingsData(prev => ({
                        ...prev,
                        trading: { ...prev.trading, defaultSlippage: value }
                      }))
                    }
                  }}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum price slippage for trades
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSettingsUpdate}>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Account Type</p>
              <Badge variant="secondary" className="mt-1">
                {(() => {
                  const tier = profile?.userTier;
                  switch (tier) {
                    case 'EMAIL_USER': return 'Email Account';
                    case 'WALLET_USER': return 'Wallet Account';
                    case 'VSOL_HOLDER': return '$SIM Holder';
                    default: return tier || 'Standard';
                  }
                })()}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-lg font-semibold">
                {profile?.virtualSolBalance || '10'} SOL
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="text-sm">
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="text-xs font-mono truncate" title={user.id}>
                {user.id}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Simulated SOL Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Simulated SOL
          </CardTitle>
          <CardDescription>
            Add more simulated SOL to your trading balance with real SOL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Balance Display */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-primary">
                  {profile?.virtualSolBalance 
                    ? parseFloat(profile.virtualSolBalance).toFixed(2)
                    : '0.00'} SOL
                </p>
              </div>
              <Wallet className="h-12 w-12 text-primary/50" />
            </div>
          </div>

          {/* Purchase Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => setPurchaseModalOpen(true)}
              className="w-full md:w-auto"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Buy More Simulated SOL
            </Button>
          </div>

          <Separator />

          {/* Purchase History */}
          <div>
            <h4 className="text-sm font-medium mb-4">Recent Purchases</h4>
            <PurchaseHistorySection userId={user?.id || ''} />
          </div>
        </CardContent>
      </Card>

      {/* Purchase Modal */}
      {user && (
        <PurchaseModal
          open={purchaseModalOpen}
          onOpenChange={setPurchaseModalOpen}
          userId={user.id}
        />
      )}
    </div>
  )
}

// Purchase History Component
function PurchaseHistorySection({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['purchaseHistory', userId],
    queryFn: () => api.getPurchaseHistory(userId, 5, 0),
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    retry: false, // Don't retry if table doesn't exist
  });

  // If there's an error (e.g., table doesn't exist), show a friendly message
  if (error) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Purchase history is currently unavailable. Please contact support if this persists.
      </div>
    );
  }

  return (
    <PurchaseHistoryTable
      purchases={data?.purchases || []}
      isLoading={isLoading}
    />
  );
}

export default UserSettingsPage