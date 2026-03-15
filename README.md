# 🎯 Tax Deduction Hunter

AI-powered platform that finds tax deductions in your bank statements.

## Stack
- **Frontend**: Next.js 15 + Tailwind
- **Backend**: FastAPI (Python)
- **AI Layer**: Coming next (Claude API classification engine)

## Quick Start

### 1. Backend
```bash
cd backend
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

## Test It
Upload `sample_transactions.csv` from the project root to see it work.

## Architecture

```
User uploads CSV
     ↓
FastAPI /api/upload/csv
     ↓
CSV Parser (smart column detection)
     ↓
Transaction normalization → common schema
     ↓
[NEXT] Classification Engine (rules + Claude AI)
     ↓
[NEXT] Deduction Recommendation Engine
     ↓
[NEXT] Review Dashboard + Export
```

## Supported CSV Formats
- Chase Bank
- Bank of America  
- Wells Fargo
- Capital One
- Citi
- Any CSV with date/description/amount columns

## What's Built
- [x] CSV upload endpoint
- [x] Smart column detection (handles any bank format)
- [x] Amount parsing ($1,234.56 | (1,234.56) | debit/credit columns)
- [x] Date parsing (all common formats)
- [x] Upload + transaction table UI
- [ ] AI classification engine
- [ ] Deduction recommendation engine
- [ ] Receipt OCR
- [ ] Review workflow
- [ ] Report export