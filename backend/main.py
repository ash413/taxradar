from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from parsers.csv_parser import parse_csv_upload
from models import ParsedUploadResponse

from dotenv import load_dotenv
load_dotenv()

from classifier import classify_transaction

app = FastAPI(title="Tax Deduction Hunter API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/upload/csv", response_model=ParsedUploadResponse)
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    
    contents = await file.read()
    
    try:
        result = parse_csv_upload(contents, filename=file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV: {str(e)}")
    
    return result


@app.post("/api/classify")
def classify(payload: dict):
    description = payload.get("description", "")
    amount = payload.get("amount", 0.0)
    date = payload.get("date", "unknown")
    result = classify_transaction(description, amount, date)
    return result


@app.post("/api/upload/classify")
async def upload_and_classify(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    
    contents = await file.read()
    
    try:
        parsed = parse_csv_upload(contents, filename=file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV: {str(e)}")
    
    classified = []
    for tx in parsed.transactions:
        classification = classify_transaction(
            description=tx.description,
            amount=tx.amount,
            date=tx.date or "unknown"
        )
        classified.append({
            "transaction": tx.model_dump(),
            "classification": classification
        })
    
    return {
        "filename": parsed.filename,
        "summary": parsed.summary.model_dump(),
        "results": classified
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)