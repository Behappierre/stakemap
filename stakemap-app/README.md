# StakeMap

Interactive stakeholder relationship mapping app. Map companies, stakeholders, and their relationships in a visual graph.

## Setup

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project (or use an existing one).
2. Run the schema migration:
   - Open **SQL Editor** in the Supabase dashboard
   - Copy and run the contents of `supabase/migrations/20250212000001_initial_schema.sql`

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Find these in Supabase: **Project Settings → API**.

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Phase 1 Features

- **Companies** – Create and edit companies (name, industry, region, tags)
- **Stakeholders** – Create and edit stakeholders with sentiment (Ally / Neutral / Opponent)
- **Relationships** – Add links between stakeholders (Reports To, Collaborates With, etc.)
- **Graph Map** – Interactive force-directed view with color-coded nodes by sentiment
- **Layout Persistence** – Drag nodes to reposition; positions are saved to the database

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Cytoscape.js (graph)
- Supabase (PostgreSQL)
