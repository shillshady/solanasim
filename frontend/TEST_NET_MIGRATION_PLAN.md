# Test Net Theme Migration Plan - Remaining Pages

## Overview
This plan covers migrating the remaining pages from Mario theme to Test Net industrial brutalist theme.

## Theme Changes Summary
- **Background**: `#09090b` (Matte Black)
- **Primary Accent**: `#E3FF00` (Acid Yellow) - buttons, profit indicators
- **Borders**: `#27272a` (Zinc 800) default, `#52525b` (Zinc 600) on hover
- **Typography**: JetBrains Mono (headings), Inter (body)
- **Corners**: 0px (sharp edges)
- **Shadows**: Flat/none

---

## Completed Pages
- [x] Landing page (home)
- [x] Hero section
- [x] Features section
- [x] How it works section
- [x] Level up section
- [x] Leaderboard preview
- [x] CTA section

---

## Phase 1: High-Priority Pages (Core Trading Flow)

### 1.1 Portfolio Page (`/portfolio`)
**File**: `frontend/app/portfolio/page.tsx`
**Components to update**:
- `frontend/components/portfolio/portfolio-widgets.tsx`
- `frontend/components/portfolio/unified-positions.tsx`
- Position cards, PnL displays

**Changes needed**:
- Remove Mario card styles (rounded corners, block shadows)
- Update profit/loss colors to `--profit` / `--loss`
- Use `font-mono` for numbers
- Sharp-cornered cards with thin borders

### 1.2 Trading Room Page (`/room/[ca]`)
**File**: `frontend/app/room/[ca]/page.tsx`
**Components**:
- Trading interface
- Chart displays
- Buy/sell panels

**Changes needed**:
- Update trading buttons (already have `.btn-buy`, `.btn-sell` classes)
- Update chart styling
- Sharp corners on all elements

### 1.3 Warp Pipes Page (`/warp-pipes`)
**File**: `frontend/app/warp-pipes/page.tsx`
**Components**:
- Token discovery feed
- Token cards

**Changes needed**:
- Update token card styling
- Remove Mario icons from token metadata
- Industrial grid layout

### 1.4 Trending Page (`/trending`)
**File**: `frontend/app/trending/page.tsx`
**Changes needed**:
- Update token list styling
- Industrial table design

### 1.5 Leaderboard Page (`/leaderboard`)
**File**: `frontend/app/leaderboard/page.tsx`
**Changes needed**:
- Already partially updated via CSS
- Check for hardcoded Mario colors
- Update rank badge styling

---

## Phase 2: Supporting Pages

### 2.1 Wallet Tracker (`/wallet-tracker`)
**File**: `frontend/app/wallet-tracker/page.tsx`
**Changes needed**:
- Update wallet cards
- Industrial table styling

### 2.2 Wallet Management (`/wallet-management`)
**File**: `frontend/app/wallet-management/page.tsx`
**Changes needed**:
- Update form inputs
- Industrial card design

### 2.3 Rewards Page (`/rewards`)
**File**: `frontend/app/rewards/page.tsx`
**Changes needed**:
- Remove Mario-themed rewards icons
- Update XP/reward displays

### 2.4 Docs Page (`/docs`)
**File**: `frontend/app/docs/page.tsx`
**Changes needed**:
- Update documentation styling
- Industrial typography

### 2.5 About Page (`/about`)
**File**: `frontend/app/about/page.tsx`
**Changes needed**:
- Update content styling
- Remove Mario references

### 2.6 Roadmap Page (`/roadmap`)
**File**: `frontend/app/roadmap/page.tsx`
**Changes needed**:
- Update timeline styling
- Industrial cards

---

## Phase 3: Feature Pages

### 3.1 Pipe Network (`/pipe-network`)
**File**: `frontend/app/pipe-network/page.tsx`
**Changes needed**:
- Update network visualization
- Industrial styling

### 3.2 Launch Page (`/launch`)
**File**: `frontend/app/launch/page.tsx`
**Changes needed**:
- Update token launch form
- Industrial form design

### 3.3 Stocks Page (`/stocks`)
**File**: `frontend/app/stocks/page.tsx`
**Changes needed**:
- Update stock list styling

### 3.4 Perps Page (`/perps`)
**File**: `frontend/app/perps/page.tsx`
**Changes needed**:
- Update perps interface styling

---

## Phase 4: Auth & Settings Pages

### 4.1 Profile Settings (`/profile/settings`)
**File**: `frontend/app/profile/settings/page.tsx`
**Changes needed**:
- Update form inputs
- Industrial toggles and buttons

### 4.2 Reset Password (`/reset-password`)
**File**: `frontend/app/reset-password/page.tsx`
**Changes needed**:
- Update auth form styling

### 4.3 Verify Email (`/verify-email`)
**File**: `frontend/app/verify-email/page.tsx`
**Changes needed**:
- Update verification page styling

### 4.4 Admin Page (`/admin`)
**File**: `frontend/app/admin/page.tsx`
**Changes needed**:
- Update admin dashboard styling

### 4.5 Offline Page (`/offline`)
**File**: `frontend/app/offline/page.tsx`
**Changes needed**:
- Update offline message styling

---

## Phase 5: Shared Components

### 5.1 Navigation Components
- [x] `nav-bar.tsx` - Logo updated to text
- [ ] `bottom-nav-bar.tsx` - Check for Mario styling

### 5.2 UI Components
- [ ] `frontend/components/ui/button.tsx` - Verify brutalist styling
- [ ] `frontend/components/ui/card.tsx` - Update card defaults
- [ ] `frontend/components/ui/input.tsx` - Update input styling
- [ ] `frontend/components/ui/dialog.tsx` - Update modal styling
- [ ] `frontend/components/ui/dropdown-menu.tsx` - Update dropdown styling

### 5.3 Trading Components
- [ ] `frontend/components/trading/token-search.tsx` - Update search styling
- [ ] `frontend/components/trading/trade-history.tsx` - Update history table
- [ ] `frontend/components/trading/sliding-trending-ticker.tsx` - Update ticker

### 5.4 Shared Components
- [ ] `frontend/components/shared/mario-page-header.tsx` - REMOVE (no longer needed)
- [ ] Check all components for `font-mario` usage - replace with `font-mono`
- [ ] Check for Mario icon imports - replace with Lucide icons

---

## Search Patterns for Cleanup

Run these searches to find remaining Mario references:

```bash
# Find Mario font usage
grep -r "font-mario" frontend/

# Find Mario colors
grep -r "mario-red\|mario-green\|luigi-green\|star-yellow\|coin-gold" frontend/

# Find Mario icons
grep -r "/icons/mario" frontend/

# Find MarioPageHeader usage
grep -r "MarioPageHeader" frontend/

# Find rounded corners that need removal
grep -r "rounded-\[1[0-9]px\]\|rounded-2xl\|rounded-xl" frontend/

# Find block shadows
grep -r "shadow-\[.*var(--outline" frontend/
```

---

## Verification Checklist

For each page:
- [ ] No Mario fonts (`font-mario`)
- [ ] No Mario colors (hardcoded reds, greens, yellows)
- [ ] No Mario icons (`/icons/mario/*`)
- [ ] No MarioPageHeader component
- [ ] Sharp corners (0px radius)
- [ ] Thin borders (1px)
- [ ] No block shadows
- [ ] Dark background visible
- [ ] Acid yellow accents where appropriate
- [ ] JetBrains Mono for headings
- [ ] Inter for body text

---

## Estimated Effort

| Phase | Pages | Complexity | Est. Files |
|-------|-------|------------|------------|
| Phase 1 | 5 | High | ~15-20 |
| Phase 2 | 6 | Medium | ~10-15 |
| Phase 3 | 4 | Medium | ~8-12 |
| Phase 4 | 5 | Low | ~5-8 |
| Phase 5 | N/A | Medium | ~15-20 |

Total: ~20 pages + ~20 shared components
