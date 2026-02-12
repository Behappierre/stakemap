-- StakeMap MVP Schema
-- Run this in Supabase SQL Editor or via: supabase db push

-- Enums
CREATE TYPE seniority_level AS ENUM ('C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'IC');
CREATE TYPE sentiment_type AS ENUM ('ALLY', 'NEUTRAL', 'OPPONENT', 'UNKNOWN');
CREATE TYPE relation_type AS ENUM (
  'REPORTS_TO', 'PEER_OF', 'INFLUENCES',
  'COLLABORATES_WITH', 'ADVISES', 'BLOCKS', 'SPONSORS', 'GATEKEEPER_FOR'
);

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  region TEXT,
  parent_company_id UUID REFERENCES companies(id),
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stakeholders
CREATE TABLE stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  seniority_level seniority_level,
  influence_score SMALLINT CHECK (influence_score >= 1 AND influence_score <= 5),
  sentiment sentiment_type DEFAULT 'UNKNOWN',
  sentiment_confidence SMALLINT CHECK (sentiment_confidence >= 1 AND sentiment_confidence <= 5),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relationships (self-referencing stakeholders)
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  to_stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  relation_type relation_type NOT NULL,
  directionality TEXT DEFAULT 'directional' CHECK (directionality IN ('directional', 'bidirectional')),
  strength SMALLINT DEFAULT 3 CHECK (strength >= 1 AND strength <= 5),
  sentiment_impact SMALLINT DEFAULT 0 CHECK (sentiment_impact IN (-1, 0, 1)),
  confidence SMALLINT CHECK (confidence >= 1 AND confidence <= 5),
  last_validated_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_relationship CHECK (from_stakeholder_id != to_stakeholder_id),
  CONSTRAINT unique_relationship UNIQUE (from_stakeholder_id, to_stakeholder_id, relation_type)
);

-- Maps (single default for MVP)
CREATE TABLE maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Default Map',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Map layouts (x/y positions per stakeholder per map)
CREATE TABLE map_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  zoom_context DOUBLE PRECISION,
  saved_by_user_id UUID, -- nullable until auth is added
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(map_id, stakeholder_id)
);

-- Indexes
CREATE INDEX idx_stakeholders_company ON stakeholders(company_id);
CREATE INDEX idx_stakeholders_sentiment ON stakeholders(sentiment);
CREATE INDEX idx_relationships_from ON relationships(from_stakeholder_id);
CREATE INDEX idx_relationships_to ON relationships(to_stakeholder_id);
CREATE INDEX idx_map_layouts_map ON map_layouts(map_id);
CREATE INDEX idx_map_layouts_stakeholder ON map_layouts(stakeholder_id);

-- Seed default map (id used by app)
INSERT INTO maps (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Default Map')
ON CONFLICT (id) DO NOTHING;
