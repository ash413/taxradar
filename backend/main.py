from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from parsers.csv_parser import parse_csv_upload
from models import ParsedUploadResponse

from dotenv import load_dotenv
load_dotenv()

from classifier import classify_transaction

from fastapi.responses import Response
from exporter import generate_csv_report, generate_pdf_report

from ocr import process_receipt

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

@app.post("/api/export/csv")
def export_csv(payload: dict):
    csv_bytes = generate_csv_report(
        results=payload["results"],
        summary=payload["summary"],
        filename=payload.get("filename", "transactions.csv")
    )
    return Response(content=csv_bytes, media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=deduction_report.csv"})

@app.post("/api/export/pdf")
def export_pdf(payload: dict):
    pdf_bytes = generate_pdf_report(
        results=payload["results"],
        summary=payload["summary"],
        filename=payload.get("filename", "transactions.csv")
    )
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=deduction_report.pdf"})



@app.post("/api/upload/receipt")
async def upload_receipt(file: UploadFile = File(...)):
    allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, or PDF files supported.")
    
    contents = await file.read()
    result = process_receipt(contents, file.content_type)
    return result


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)