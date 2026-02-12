# Technical Requirements Document (TRD): StakeMap MVP

## 1. System Architecture
The system will follow a **decoupled Client-Server architecture** to support a highly interactive, stateful frontend and a relational backend capable of graph-like queries.

* **Frontend**: React (v18+) with TypeScript.
* **State Management**: Zustand or Redux for high-frequency graph state updates.
* **Graph Engine**: Cytoscape.js, React Flow, or Sigma.js.
    * *Requirement*: Must support WebGL or Canvas rendering to meet the performance target of 2,000+ nodes.
* **Backend**: Node.js (NestJS/Express) or Python (FastAPI).
* **Database**: PostgreSQL (relational).
* **Deployment**: Containerized services with managed PostgreSQL.

---

## 2. Technical Data Schema
The database must enforce referential integrity while allowing for the "soft" relationships defined in the PRD.

### 2.1 Core Entities
* **Companies**: id (UUID), name, industry, region, parent_company_id (nullable), and tags.
* **Stakeholders**: id (UUID), company_id (FK), full_name, title, department, seniority_level (enum), influence_score (1–5), and sentiment (enum).
* **Relationships**: A self-referencing join table for Stakeholders.
    * `from_stakeholder_id`, `to_stakeholder_id` (FKs).
    * `relation_type` (Enum: REPORTS_TO, COLLABORATES_WITH, etc.).
    * `sentiment_impact`: Integer (-1, 0, 1).

### 2.2 Layout Persistence (FR-11)
* **MapLayouts**: This table must store X/Y coordinates linked to a `stakeholder_id` and a `map_id`.
    * Coordinates must be stored as floats to maintain precision across different viewport resolutions.

---

## 3. Specific Functional Specifications

### 3.1 Graph Visualization & Interaction
The developer must implement a **Force-Directed Layout** for general exploration and a **Tree/Hierarchical Layout** for company-specific views.

* **Node Styling**:
    * **Color**: Green (Ally), Red (Opponent), Gray/Blue (Neutral).
    * **Shapes/Icons**: Distinct by seniority level (C-Level, VP, etc.).
    * **Border**: Amber outline for "Unknown" or low-confidence data.
* **Edge Styling**: 
    * **Directionality**: Arrows for directional relationships like `REPORTS_TO` or `GATEKEEPER_FOR`.
    * **Weight**: Edge thickness must scale based on `strength` (1–5).
* **Performance**: The implementation must utilize "Level of Detail" (LoD) rendering—hiding non-essential labels when zooming out to maintain 60 FPS during pan/zoom.

### 3.2 Audit & Logging (FR-15 & FR-16)
Every mutation (Create/Edit/Delete) must trigger an entry in the `AuditEvents` table.
* **Required fields**: `entity_type`, `entity_id`, `action`, `changed_by`, `changed_at`, and `diff_json`.

### 3.3 Bulk Import (FR-4)
The backend must provide a CSV validation endpoint.
* **Validation**: Check for mandatory fields (Name, Company) and seniority enums.
* **Transactionality**: Imports must be atomic—if one row fails, the entire batch should roll back to prevent partial data corruption.

---

## 4. API Endpoints (RESTful)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/companies` | GET/POST | List/Create companies |
| `/api/v1/stakeholders` | GET/POST/PATCH | CRUD for stakeholder profiles |
| `/api/v1/relationships` | GET/POST/DELETE | Manage links between stakeholders |
| `/api/v1/maps/:id/layout` | PUT | Save manual X/Y positions for a specific map |
| `/api/v1/insights/top-influencers` | GET | Identify nodes with high degree-centrality |

---

## 5. Security & Governance
* **Authentication**: Role-Based Access Control (Admin, Editor, Viewer).
* **Encryption**: TLS for data in transit and encryption at rest for the PostgreSQL instance.
* **Compliance**: GDPR-ready controls for data export and soft-deletion/restore support.

---

## 6. Technical Acceptance Criteria
1.  **Rendering**: 500 nodes with 1,000 edges must render and remain interactively "draggable" without visible lag.
2.  **State Sync**: Changes made in the "Detail Panel" must reflect on the Graph Node immediately without a full page refresh.
3.  **Persistence**: Refreshing the browser after dragging a node must maintain that node's new position based on the saved layout.