# Findings & Decisions - UI Design

## Requirements
- Modern Clean Medical Aesthetic theme
- Color Palette: White, Off-White, Dark Charcoal, Gold, Beige, Mint
- All pages for QR Authenticity System
- Responsive design
- Thai/English support

## Design Direction
### Aesthetic: Luxury Medical Aesthetic
**Characteristics:**
- Clean, generous whitespace
- Subtle depth with soft shadows
- Premium gold accents
- Trustworthy, professional feel
- Refined typography
- Smooth micro-interactions

**Inspiration:**
- High-end medical clinics
- Luxury skincare brands
- Premium SaaS dashboards

## Color Usage Guidelines
| Element | Primary | Secondary | Accent |
|---------|---------|-----------|--------|
| Background | #FFFFFF | #F7F4EF | - |
| Text | #1E1E1E | #6B7280 | - |
| Primary Button | #C9A35A | - | hover: darken |
| Secondary Button | #E9DDD0 | - | border |
| Success | #73CFC7 | - | - |
| Card | #FFFFFF | - | shadow |
| Input Border | #E9DDD0 | #C9A35A (focus) | - |
| Sidebar | #1E1E1E | - | - |

## Typography Scale
```
Display: Playfair Display
- Hero: 48px / 56px
- Page Title: 32px / 40px

Body: DM Sans
- Large: 18px / 28px
- Base: 16px / 24px
- Small: 14px / 20px
- XS: 12px / 16px

Font Weights:
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700
```

## Component Patterns
### Buttons
- Primary: Gold bg, white text, subtle shadow
- Secondary: Beige bg, charcoal text
- Ghost: Transparent, charcoal text, beige border
- Size: lg (48px), md (40px), sm (32px)

### Cards
- White background
- Subtle shadow (0 4px 6px rgba(0,0,0,0.05))
- Rounded corners (12px)
- Padding: 24px

### Inputs
- White background
- Beige border
- Gold border on focus
- Rounded (8px)
- Height: 44px

### Tables
- White background
- Off-white header
- Beige borders
- Hover: light beige bg

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| CSS Variables | Consistent theming, easy maintenance |
| Tailwind + Custom CSS | Speed + custom aesthetic |
| next/font for Google Fonts | Performance optimization |
| Framer Motion | Smooth animations |
| React Icons | Consistent iconography |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- Google Fonts: Playfair Display, DM Sans
- Lucide Icons or React Icons
- Tailwind CSS v4
