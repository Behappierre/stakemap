# Product Requirements Document (PRD)
## Product Name (working): StakeMap

## 1. Purpose

Build an interactive web application to map and track stakeholders across multiple companies, including:

- Who they are
- Which company they belong to
- Their role and hierarchy
- Cross-company relationships
- Relationship sentiment (ally/neutral/opponent)
- Visual, dynamic exploration via mouse interactions
- Clear color-coded status at a glance

The goal is to help a user quickly understand influence networks, reporting lines, and inter-company connections for strategy, sales, partnerships, and stakeholder management.

---

## 2. Objectives & Success Criteria

### 2.1 Business Objectives
1. Centralize stakeholder intelligence across multiple organizations.
2. Make relationship patterns visible and actionable.
3. Reduce time spent preparing stakeholder strategy for meetings/opportunities.

### 2.2 User Success Criteria (MVP)
- User can create and edit companies, stakeholders, and links in fewer than 3 clicks per action.
- User can visually identify allies/opponents via color/symbol without opening details.
- User can drag nodes and build a map interactively with mouse.
- User can filter by company, sentiment, influence, and role level.
- User can save and re-open maps with layout persistence.

### 2.3 Product KPIs
- Time-to-first-map (from sign-in to first usable stakeholder map) < 10 minutes.
- % stakeholders with complete profile (company + role + sentiment) > 80%.
- Weekly active usage by user > 2 sessions/week.
- Average query-to-insight task time reduced by 50% vs manual notes/spreadsheets.

---

## 3. Users & Personas

1. **Strategic Account Lead / Partner**  
   Needs cross-company influence mapping before bids/sales cycles. Wants fast “who influences whom” answers.

2. **Business Development Manager**  
   Tracks contacts across customer, supplier, and regulator organizations. Needs sentiment tagging and relationship strength.

3. **Program/Delivery Lead**  
   Understands governance structures and escalation routes. Needs hierarchy and power centers quickly.

---

## 4. Scope

### 4.1 In Scope (MVP)
- Multi-company support.
- Stakeholder profiles (name, role, company, level, tags).
- Intra-company hierarchy links (e.g., reports to).
- Cross-company relationship links (e.g., collaborator, influencer, blocker).
- Sentiment tagging (ally/neutral/opponent).
- Color-coded graph visualization.
- Drag-and-drop node map with zoom/pan.
- Search, filter, highlight paths.
- Basic audit trail for changes.
- Notes/timeline on stakeholders.

### 4.2 Out of Scope (MVP)
- Automatic enrichment from LinkedIn/CRM.
- AI-inferred relationship scoring.
- Email/calendar integration.
- Real-time multi-user collaboration.
- Mobile-native app (web responsive only in MVP).

---

## 5. Functional Requirements

### 5.1 Company Management
- **FR-1**: User can create/edit/archive a company with fields:
  - Company name
  - Industry
  - Region
  - Parent company (optional)
  - Tags
- **FR-2**: User can view all stakeholders grouped by company.

### 5.2 Stakeholder Management
- **FR-3**: User can create/edit/archive stakeholder profiles:
  - Full name
  - Job title
  - Company (required)
  - Department/function
  - Seniority level (e.g., C-Level, VP, Director, Manager, IC)
  - Influence score (1–5)
  - Sentiment: Ally / Neutral / Opponent / Unknown
  - Confidence level
  - Contact metadata (optional)
  - Notes + dated interaction log
- **FR-4**: User can bulk import stakeholders from CSV.

### 5.3 Hierarchy & Relationships
- **FR-5**: User can create intra-company links:
  - `REPORTS_TO`
  - `PEER_OF`
  - `INFLUENCES`
- **FR-6**: User can create cross-company links:
  - `COLLABORATES_WITH`
  - `ADVISES`
  - `BLOCKS`
  - `SPONSORS`
  - `GATEKEEPER_FOR`
- **FR-7**: Each link supports:
  - Directional vs bidirectional
  - Strength (1–5)
  - Sentiment impact (+ / 0 / -)
  - Last validated date
  - Source/confidence notes

### 5.4 Visualization & Interaction
- **FR-8**: Graph map view with:
  - Nodes = stakeholders (optional company nodes)
  - Edges = relationships
  - Color coding by sentiment or company
  - Shapes/icons by role level
  - Edge style by relationship type and strength
- **FR-9**: Mouse interactions:
  - Click node = open detail panel
  - Drag node = reposition
  - Shift+drag = multi-select
  - Mouse wheel = zoom
  - Click+drag canvas = pan
  - Right-click node/edge = quick actions
- **FR-10**: Layout modes:
  - Force-directed network view
  - Org hierarchy view (per selected company)
  - Hybrid clustered view
- **FR-11**: Save manual node positions per user/view.

### 5.5 Search, Filters & Insights
- **FR-12**: Global search by name/company/role/tag.
- **FR-13**: Filter by company, role level, sentiment, relationship type, influence score, last updated.
- **FR-14**: Highlight:
  - Direct path between two stakeholders
  - Top influencers in scope
  - Opponents connected to a key account

### 5.6 Activity, Audit & Governance
- **FR-15**: Log create/edit/delete actions (who/what/when).
- **FR-16**: Change history per stakeholder/relationship.
- **FR-17**: Soft-delete with restore support.

---

## 6. UX Requirements

### 6.1 Design Principles
- Fast to learn
- Visual first, detail second
- At-a-glance clarity via color + icons
- Few clicks to common actions

### 6.2 Color Semantics (Default)
- Ally: green
- Neutral: gray/blue
- Opponent: red
- Unknown/unvalidated: amber outline

Include colorblind-friendly mode and accessible contrast.

### 6.3 Primary Screens
1. **Dashboard**
2. **Map Workspace**
3. **Stakeholder Detail**
4. **Company View**

### 6.4 Key UX Flows
- Add stakeholder → assign company → set role/sentiment → auto-place in map.
- Draw relationship by dragging connector from node A to B.
- Toggle company cluster/hierarchy views in one click.
- Hover tooltips show key details (name, role, sentiment, influence).

---

## 7. Data Model (Logical)

### 7.1 Company
- id (UUID)
- name
- industry
- region
- parent_company_id (nullable)
- tags[]
- created_at / updated_at

### 7.2 Stakeholder
- id (UUID)
- company_id (FK)
- full_name
- title
- department
- seniority_level (enum)
- influence_score (1–5)
- sentiment (enum)
- sentiment_confidence (1–5)
- status (active/archived)
- created_at / updated_at

### 7.3 Relationship
- id (UUID)
- from_stakeholder_id (FK)
- to_stakeholder_id (FK)
- relation_type (enum)
- directionality
- strength (1–5)
- sentiment_impact (-1/0/+1)
- confidence (1–5)
- last_validated_at
- notes
- created_at / updated_at

### 7.4 InteractionLog
- id
- stakeholder_id
- date
- channel
- summary
- outcome
- next_action
- owner_user_id

### 7.5 MapLayout
- id
- map_id
- stakeholder_id
- x, y
- zoom_context
- saved_by_user_id

### 7.6 AuditEvent
- id
- entity_type
- entity_id
- action
- changed_by
- changed_at
- diff_json

---

## 8. Permissions & Roles

- **Admin**: Full control, user/workspace management.
- **Editor**: Create/edit stakeholders and relationships.
- **Viewer**: Read-only.

---

## 9. Non-Functional Requirements

- **Performance**: Smooth at up to 2,000 nodes / 8,000 edges (MVP target).
- **Availability**: 99.5% target.
- **Security**: RBAC, encryption in transit and at rest.
- **Compliance**: GDPR-ready export/deletion/retention controls.
- **Usability**: Keyboard shortcuts and WCAG AA-friendly UI.

---

## 10. Technical Approach (Suggested)

### 10.1 Frontend
- React + TypeScript
- Graph engine: Cytoscape.js / React Flow / Sigma.js
- State management: Zustand or Redux
- Accessible component library

### 10.2 Backend
- Node.js (NestJS/Express) or Python (FastAPI)
- PostgreSQL
- Optional graph projection for analytics
- Redis cache for heavy graph queries

### 10.3 API
- REST or GraphQL
- Core resources:
  - `/companies`
  - `/stakeholders`
  - `/relationships`
  - `/maps/:id/layout`
  - `/insights/top-influencers`

### 10.4 Deployment
- Containerized services
- Managed Postgres
- Observability: logs, metrics, traces, alerts

---

## 11. Reporting & Export

- Map snapshot export (PNG/SVG)
- CSV export (stakeholders/relationships)
- PDF one-page stakeholder brief (selected person/company)

---

## 12. Acceptance Criteria (MVP)

1. Create at least 3 companies and 50 stakeholders without errors.
2. Define hierarchy within each company.
3. Add at least 2 cross-company links per stakeholder.
4. Sentiment color-coding visible in map + detail panel.
5. Drag/drop remains fluid at 500+ nodes.
6. Filters update map in < 1 second for standard datasets.
7. Audit trail records all updates.
8. Exported CSV matches filtered dataset exactly.

---

## 13. Risks & Mitigations

1. **Subjective sentiment data**
   - Mitigation: confidence score + last validated date + owner.
2. **Visual clutter at scale**
   - Mitigation: clustering, focus mode, level-of-detail rendering.
3. **Adoption friction**
   - Mitigation: guided onboarding + templates.
4. **Security/privacy concerns**
   - Mitigation: strict RBAC, isolation, audit logs.

---

## 14. Delivery Plan (Indicative)

### Phase 0 — Discovery (1–2 weeks)
- Validate workflows, fields, taxonomy.
- Finalize wireframes and data dictionary.

### Phase 1 — Core Build (4–6 weeks)
- CRUD for core entities
- Interactive map
- Sentiment color coding
- Search/filter
- Audit basics

### Phase 2 — Hardening (2–3 weeks)
- Performance tuning
- CSV import/export
- Layout persistence
- Permissions + QA/UAT

### Phase 3 — Post-MVP
- CRM integrations
- AI suggestions
- Collaboration features
- Time-based relationship evolution

---

## 15. Post-MVP Backlog

- Relationship health trends
- Influence propagation simulation
- Meeting prep auto-pack
- Duplicate contact merge suggestions
- Job-change alerts
