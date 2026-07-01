# NFRS Financial Reporter
### Nepal Financial Reporting Automation for NAS/NFRS Compliance

Generate ICAN-compliant financial statements from your accounting software's trial balance in minutes.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY for AI account matching

# 3. Start development server
npm run dev
# Opens at http://localhost:3000

# 4. Production build
npm run build
npm start
```

## Project Structure

```
nfrs-reporter/
├── src/                          # React frontend (Vite + TypeScript)
│   ├── components/
│   │   ├── ui/                   # Reusable UI components
│   │   ├── layout/               # AppShell, Sidebar, Header, WizardProgress
│   │   ├── company/              # Company setup forms
│   │   ├── trialBalance/         # TB upload, mapping, validation
│   │   ├── adjustments/          # Asset register, provisions
│   │   ├── statements/           # Balance Sheet, IS, CF, Equity views
│   │   └── output/               # Download panel
│   ├── pages/                    # Full-page route components
│   ├── store/                    # React Context + useReducer global state
│   ├── types/                    # TypeScript interfaces
│   ├── data/                     # Static data (fiscal years, CoA, sample data)
│   └── utils/                    # Calendar, formatting, validation helpers
│
├── server/                       # Express backend (Node.js + TypeScript)
│   ├── routes/                   # API route handlers
│   ├── services/                 # Business logic
│   │   ├── tbParser.ts           # Trial balance parser (XLSX/CSV)
│   │   ├── accountMatcher.ts     # Deterministic account name matching
│   │   ├── aiAccountMatcher.ts   # Claude AI fallback matching
│   │   ├── depreciationEngine.ts # SLM/WDV depreciation calculations
│   │   ├── financialEngine.ts    # Full financial statement computation
│   │   ├── taxEngine.ts          # Nepal income tax computation
│   │   └── excelWriter.ts        # ExcelJS workbook generation
│   ├── middleware/               # Multer upload, error handler, security
│   └── store/                    # In-memory session store
│
└── dist/                         # Production build output
```
