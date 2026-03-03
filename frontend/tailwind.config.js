/** @type {import('tailwindcss').Config} */

// Solana Sim Design System - Tailwind Configuration
// This file establishes the core design tokens for the Solana Sim Trading Platform

module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Brand Core
        primary: {
          DEFAULT: "#6366F1", // Indigo 500 - Main brand color
          50: "#EEF2FF", // Indigo 50
          100: "#E0E7FF", // Indigo 100
          200: "#C7D2FE", // Indigo 200
          300: "#A5B4FC", // Indigo 300
          400: "#818CF8", // Indigo 400
          500: "#6366F1", // Indigo 500 - PRIMARY DEFAULT
          600: "#4F46E5", // Indigo 600
          700: "#4338CA", // Indigo 700
          800: "#3730A3", // Indigo 800
          900: "#312E81", // Indigo 900
          950: "#1E1B4B", // Indigo 950
          foreground: "#FFFFFF", // White text on primary backgrounds
        },
        
        // Trading Specific Colors - Used for PnL indications
        profit: {
          DEFAULT: "#10B981", // Green 500 - Primary profit color
          light: "#D1FAE5", // Green 100 - Background for positive indicators
          foreground: "#FFFFFF", // White text on profit backgrounds
        },
        loss: {
          DEFAULT: "#EF4444", // Red 500 - Primary loss color
          light: "#FEE2E2", // Red 100 - Background for negative indicators
          foreground: "#FFFFFF", // White text on loss backgrounds
        },
        
        // UI Elements
        neutral: {
          50: "#F8FAFC", // Slate 50
          100: "#F1F5F9", // Slate 100
          200: "#E2E8F0", // Slate 200
          300: "#CBD5E1", // Slate 300
          400: "#94A3B8", // Slate 400
          500: "#64748B", // Slate 500
          600: "#475569", // Slate 600
          700: "#334155", // Slate 700
          800: "#1E293B", // Slate 800
          900: "#0F172A", // Slate 900
          950: "#020617", // Slate 950
        },
        
        // Chart-specific colors
        chart: {
          grid: "rgba(203, 213, 225, 0.2)", // Slate 300 at 20% opacity
          volume: "rgba(99, 102, 241, 0.2)", // Indigo 500 at 20% opacity
          positive: "#10B981", // Green 500 - Same as profit
          negative: "#EF4444", // Red 500 - Same as loss
        },
        
        // Brand Accent - Warm Gold/Cream
        brand: {
          DEFAULT: "var(--brand)",
          foreground: "var(--brand-foreground)",
          muted: "var(--brand-muted)",
        },

        // UI Semantic Colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      
      // Typography Scale
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      
      // Font Weights for Trading UI
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      
      // Border Radius Scale
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      
      // Animation Timing
      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },
      
      // Standardized Spacing Scale for Design System
      spacing: {
        // Base spacing scale (enhances Tailwind defaults)
        'xs': '0.25rem',      // 4px - Micro adjustments
        'sm': '0.5rem',       // 8px - Tight spacing
        'md': '1rem',         // 16px - Standard spacing
        'lg': '1.5rem',       // 24px - Relaxed spacing
        'xl': '2rem',         // 32px - Loose spacing
        'xxl': '3rem',        // 48px - Extra loose spacing
        
        // Component-specific spacing
        'card-padding': '1.25rem',     // 20px - Standard card padding
        'card-padding-sm': '1rem',     // 16px - Compact card padding
        'card-padding-lg': '1.5rem',   // 24px - Spacious card padding
        'panel-gap': '1rem',           // 16px - Gap between trading panel elements
        'section-gap': '2rem',         // 32px - Gap between page sections
        'content-gap': '1.5rem',       // 24px - Gap between content blocks
        
        // Layout spacing
        'navbar-height': '4rem',           // 64px - Navigation bar height
        'trade-strip-height': '2.5rem',   // 40px - Trade strip height
        'bottom-nav-height': '4rem',      // 64px - Bottom navigation height
        'sidebar-width': '16rem',         // 256px - Sidebar width
        'sidebar-width-collapsed': '4rem', // 64px - Collapsed sidebar width
        
        // Chart and visualization
        'chart-height': '24rem',          // 384px - Standard chart height
        'chart-height-sm': '16rem',       // 256px - Small chart height
        'chart-height-lg': '32rem',       // 512px - Large chart height
        'chart-padding': '1rem',          // 16px - Chart container padding
        
        // Form elements
        'input-padding': '0.75rem',       // 12px - Input field padding
        'button-padding-sm': '0.5rem 1rem',  // 8px 16px - Small button padding
        'button-padding-md': '0.75rem 1.5rem', // 12px 24px - Medium button padding
        'button-padding-lg': '1rem 2rem',    // 16px 32px - Large button padding
        
        // Interactive elements
        'hover-offset': '0.125rem',       // 2px - Subtle hover movement
        'focus-offset': '0.25rem',        // 4px - Focus state offset
        'border-radius-sm': '0.25rem',    // 4px - Small border radius
        'border-radius-md': '0.5rem',     // 8px - Medium border radius
        'border-radius-lg': '0.75rem',    // 12px - Large border radius
      },
      
      // Standardized Container Max-Widths
      maxWidth: {
        'page-sm': '768px',       // Small pages (forms, settings)
        'page-md': '1024px',      // Medium pages (profiles, docs)
        'page-lg': '1280px',      // Large pages (trading, portfolio)
        'page-xl': '1536px',      // Extra large pages (leaderboard, trending)
        'page-full': '1920px',    // Full width pages (dashboards)
        'content': '1920px',      // Default content max-width
        'dialog-sm': '425px',     // Small dialogs
        'dialog-md': '600px',     // Medium dialogs
        'dialog-lg': '768px',     // Large dialogs
        'notification': '420px',  // Notification containers
      },
      
      // Standardized Border Radius Scale
      borderRadius: {
        'none': '0',
        'xs': '0.125rem',      // 2px - Very small radius
        'sm': '0.25rem',       // 4px - Small radius (buttons, inputs)
        'DEFAULT': '0.375rem', // 6px - Default radius
        'md': '0.5rem',        // 8px - Medium radius (cards, panels)
        'lg': '0.75rem',       // 12px - Large radius (dialogs, modals)
        'xl': '1rem',          // 16px - Extra large radius
        'xxl': '1.5rem',       // 24px - Very large radius
        'full': '9999px',      // Full circle/pill shape
      },
      
      // Box Shadows for UI Depth
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'button': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'dropdown': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      
      // Z-index Scale for Proper Layering
      zIndex: {
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        '75': '75',
        '100': '100',
        'dropdown': '1000',
        'sticky': '1100',
        'modal': '1300',
        'popover': '1400',
        'tooltip': '1500',
      },
      
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse-subtle": {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 },
        },
        "number-change": {
          '0%': { opacity: 0, transform: 'translateY(100%)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        "fade-in": {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        "shimmer": {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "number-change": "number-change 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
