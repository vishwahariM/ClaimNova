# ClaimPulse: AI-Powered Insurance Claim Exception & Delay Resolution

> **Core Thesis:** "Insurance claims should not just be processed. They should be kept from getting stuck."  
> **Tagline:** "Detect the exception. Explain the reason. Take the next best action."

ClaimPulse is an enterprise-grade insurtech orchestration platform designed to eliminate insurance claim bottlenecks. By combining a transparent, rule-based AI decision engine with dynamic document verification, claim readiness scoring, priority review queues, and an operational command center, ClaimPulse detects exceptions early and guides every claim to the next best action.

---

## Technical Architecture

ClaimPulse is engineered with a modular, production-ready backend design:

```
ClaimPulse/
├── app.py                      # Flask REST Controller & Route Handlers
├── config.py                   # Central Configuration & Risk Parameters
├── requirements.txt            # Python Dependencies
├── .env                        # Environment Configuration (Mongo URI)
│
├── services/
│   ├── ai_engine.py            # Master Explainable AI & Exception Orchestration Engine
│   ├── document_engine.py      # Dynamic Checklist Verification Engine
│   ├── risk_engine.py          # Risk Score & Claim Readiness Scoring Engine
│   └── notification_service.py # Chronological Activity Log Timeline Service
│
├── templates/
│   └── index.html              # Upgraded Single-Page Interface & Case Workspace Modal
│
└── static/
    ├── style.css               # Insurtech Enterprise CSS & Responsive Design System
    └── script.js               # Multi-Step Wizard, Pre-Check & Dashboard Controller
```

---

## Key Upgraded Features

1. **Modular Explainable AI Engine (`services/ai_engine.py`)**:
   - Evaluates parameters, computes a point-based Risk Score, and assigns Risk Ratings (`LOW`, `MEDIUM`, `HIGH`).
   - Calculates **Claim Readiness Score (0–100%)** and status (`READY`, `ACTION REQUIRED`, `INCOMPLETE`).
   - Generates structured Exception Objects (`MISSING_DOCUMENT`, `HIGH_VALUE_CLAIM`, `INCOMPLETE_CLAIM`).
   - Determines **Next-Best Action** (`REQUEST_DOCUMENTS`, `MANUAL_REVIEW`, `PROCEED_TO_OFFICER`, `APPROVE`, `REJECT`).
   - Provides clear factor breakdowns ("Why this decision?").

2. **5-Step Guided Claim Submission Wizard & AI Pre-Check**:
   - Step 1: Customer Information
   - Step 2: Policy Details & Claim Amount
   - Step 3: Document Attachments
   - Step 4: **AI Pre-Check** ("Run AI Pre-Check" simulation analyzing readiness before DB submission)
   - Step 5: Final Submission & Assigned Claim ID (`CP-00001`).

3. **Officer Command Center & Case Workspace Modal**:
   - **Priority Review Queue**: Highlights `CRITICAL` & `HIGH` priority claims requiring urgent review.
   - **Search & Filter Controls**: Real-time search by ID, Customer, or Policy Number, with filters for Risk, Status, Type, and Sorting.
   - **Officer Claim Detail Workspace Modal**: Full-featured case workspace with tabs for Overview, Document Checklist, Explainable Risk Factors, Exceptions List, Activity Timeline, and Decision Controls (`Approve`, `Reject`, `Under Review`, `Request Documents`).

4. **Chronological Activity Log Timeline**:
   - Tracks all events from initial submission, AI pre-check execution, officer views, and decision changes with timestamps and actor signatures.

5. **Proposed NewgenONE Integration Architecture**:
   - Visual architectural diagram showing how ClaimPulse AI acts as a decision layer above workflow platforms like NewgenONE.

---

## Installation & Setup

### Prerequisites
- Python 3.9+
- MongoDB installed and running locally on port `27017` (or MongoDB Atlas string)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Verify `.env` Configuration
```env
MONGO_URI=mongodb://localhost:27017/
PORT=5000
DEBUG=True
```

### 3. Launch Application
```bash
python app.py
```

Open your browser at **`http://127.0.0.1:5000`**.

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Serves the main ClaimPulse application |
| `GET` | `/health` | Health check and MongoDB status |
| `POST` | `/ai-precheck` | Instant AI Pre-Check evaluation without saving |
| `POST` | `/submit-claim` | Creates claim, runs AI analysis, initializes timeline, saves to DB |
| `GET` | `/claims` | Search, filter (risk/status/type), and sort claims queue |
| `GET` | `/claim/<claim_id>` | Retrieves detailed claim report, activity log, and risk breakdown |
| `GET` | `/officer-dashboard` | Calculates statistics, Priority Queue, and returns claims |
| `POST | `/claim/<claim_id>/decision` | Updates claim decision, stage, and appends timeline event |
| `GET` | `/analytics` | Calculates operational analytics dynamically from MongoDB |
