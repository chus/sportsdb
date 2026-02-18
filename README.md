# SportsDB — The International Sports Database

A structured, canonical sports entity database (football-first) with time-aware data modeling.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up your database
#    Create a free Postgres database at https://neon.tech
#    Copy connection string to .env.local
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL

# 3. Push schema to database
npm run db:push

# 4. Seed with sample data
npm run db:seed

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

See [docs/architecture.md](docs/architecture.md) for full details on tech stack, database schema, API routes, and implementation roadmap.

## Tech Stack

Next.js 15 (App Router) · Tailwind CSS v4 · PostgreSQL via Neon · Drizzle ORM · Radix UI · lucide-react

## Key URLs

| Route | Description |
|-------|-------------|
| `/` | Home page |
| `/players/:slug` | Player profile |
| `/teams/:slug` | Team profile |
| `/competitions/:slug` | Competition (current season) |
| `/competitions/:slug/:season` | Competition for specific season |
| `/matches/:id` | Match detail |
| `/search?q=...` | Search results |
# Trigger deploy
