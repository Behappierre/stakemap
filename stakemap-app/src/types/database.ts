export type SeniorityLevel = 'C_LEVEL' | 'VP' | 'DIRECTOR' | 'MANAGER' | 'IC';
export type SentimentType = 'ALLY' | 'NEUTRAL' | 'OPPONENT' | 'UNKNOWN';
export type RelationType =
  | 'REPORTS_TO'
  | 'PEER_OF'
  | 'INFLUENCES'
  | 'COLLABORATES_WITH'
  | 'ADVISES'
  | 'BLOCKS'
  | 'SPONSORS'
  | 'GATEKEEPER_FOR';

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  region: string | null;
  parent_company_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Stakeholder {
  id: string;
  company_id: string;
  full_name: string;
  title: string | null;
  department: string | null;
  seniority_level: SeniorityLevel | null;
  influence_score: number | null;
  sentiment: SentimentType;
  sentiment_confidence: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  companies?: Company;
}

export interface Relationship {
  id: string;
  from_stakeholder_id: string;
  to_stakeholder_id: string;
  relation_type: RelationType;
  directionality: string;
  strength: number | null;
  sentiment_impact: number | null;
  confidence: number | null;
  last_validated_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MapLayout {
  id: string;
  map_id: string;
  stakeholder_id: string;
  x: number;
  y: number;
  zoom_context: number | null;
  saved_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Map {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      companies: { Row: Company; Insert: Omit<Company, 'created_at' | 'updated_at'> & Partial<{ created_at: string; updated_at: string }>; Update: Partial<Company> };
      stakeholders: { Row: Stakeholder; Insert: Omit<Stakeholder, 'created_at' | 'updated_at'> & Partial<{ created_at: string; updated_at: string }>; Update: Partial<Stakeholder> };
      relationships: { Row: Relationship; Insert: Omit<Relationship, 'created_at' | 'updated_at'> & Partial<{ created_at: string; updated_at: string }>; Update: Partial<Relationship> };
      maps: { Row: Map; Insert: Map; Update: Partial<Map> };
      map_layouts: { Row: MapLayout; Insert: Omit<MapLayout, 'created_at' | 'updated_at'> & Partial<{ created_at: string; updated_at: string }>; Update: Partial<MapLayout> };
    };
  };
}
