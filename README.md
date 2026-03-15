# 🎯 TaxRadar

AI-powered platform that finds tax deductions in your bank statements and receipts.

## Stack
- **Frontend**: Next.js 15 + Tailwind
- **Backend**: FastAPI (Python)
- **AI Layer**: Claude API (classification + receipt vision)
- **OCR**: Claude Vision (replaced Tesseract for accuracy)

## Quick Start

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000
Backend API at http://localhost:8000
API docs at http://localhost:8000/docs

### 3. Environment
Create a `.env` file in the `backend` folder:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Test It
Upload `sample_transactions.csv` from the project root, then try scanning a receipt photo.

## Architecture
```
User uploads CSV                    User uploads Receipt (JPG/PNG/PDF)
      ↓                                          ↓
FastAPI /api/upload/classify         FastAPI /api/upload/receipt
      ↓                                          ↓
CSV Parser (smart column detection)   Claude Vision (direct image read)
      ↓                                          ↓
Transaction normalization             Structured receipt extraction
      ↓                                          ↓
Classification Engine                 Receipt ↔ Transaction matching
  → Layer 1: rules (known merchants)
  → Layer 2: Claude AI (ambiguous)
      ↓
Deduction Recommendation Engine
      ↓
Dashboard + PDF/CSV Export
```

## Supported CSV Formats
- Chase Bank
- Bank of America
- Wells Fargo
- Capital One
- Citi
- Any CSV with date/description/amount columns

## API Endpoints
- `POST /api/upload/classify` — upload CSV, returns classified transactions
- `POST /api/upload/receipt` — upload receipt image/PDF, returns parsed data
- `POST /api/export/pdf` — generate PDF deduction report
- `POST /api/export/csv` — generate CSV deduction report

## What's Built
- [x] CSV upload + smart column detection (any bank format)
- [x] Amount parsing ($1,234.56 | (1,234.56) | debit/credit columns)
- [x] Date parsing (all common formats)
- [x] Hybrid classification engine (rules + Claude AI)
- [x] Deduction recommendation by category
- [x] Receipt scanning via Claude Vision
- [x] Receipt ↔ transaction matching
- [x] Dashboard with deduction summary
- [x] PDF + CSV export
- [x] TaxRadar branding + two-zone upload UI