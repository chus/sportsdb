# SportsDB — Project Context

## What this is
An SEO-friendly sports entity database (football-first). Not a news app or stats platform.
A structured, canonical database with time-aware data modeling.

## Architecture
See docs/architecture.md for full schema, stack decisions, and roadmap.

## Tech Stack
- Next.js 15 (App Router) with TypeScript
- Tailwind CSS v4 + Radix UI + lucide-react
- PostgreSQL 16 via Neon (serverless)
- Drizzle ORM
- Deployed on Vercel

## Key Patterns
- Server Components for all page-level data fetching
- 'use client' only for: TimeToggle, SearchBar, live match polling
- Time-awareness: valid_from/valid_to for temporal, season_id for season-scoped
- All entity queries live in src/lib/queries/
- Drizzle schema in src/lib/db/schema.ts

## Conventions
- Slugs for all public URLs (/players/:slug, /teams/:slug)
- UUIDs for internal IDs
- Zod for all validation
- date-fns for date handling
- No barrel exports — import directly from files
- Use cn() utility for conditional classNames (Tailwind merge)

## Design System
- Primary: blue-600 (#2563eb), Indigo: indigo-600 (#4f46e5), Purple: purple-700 (#7e22ce)
- Live signals: red-500, Trending: orange-500, Rising: green-500
- Cards: rounded-xl, border border-neutral-200, hover:shadow-xl
- Hero sections: 400-500px height, gradient overlays, 5xl-7xl titles
- Sticky nav: bg-white/95 backdrop-blur-md
- Spacing: sections py-16, cards p-6, gaps gap-6, container max-w-7xl mx-auto px-4
- See docs/architecture.md § Design Documentation and Figma components in src/components/

## Figma Components (ported)
Pre-built components from Figma export live in src/components/.
They currently use mock data and callback props (onNavigate, onBack).
When building pages, refactor these to use real data from server queries
and Next.js Link for navigation. Keep the visual design identical.

## Current Phase
Phase 0: Project bootstrap — COMPLETE.
Next: Phase 1 — Layout Shell + Search.
See docs/architecture.md § Implementation Roadmap.
