from pydantic import BaseModel
from typing import Optional
from datetime import date

class Transaction(BaseModel):
    id: str
    date: Optional[str] = None
    merchant: Optional[str] = None
    description: str
    amount: float
    currency: str = "USD"
    category_hint: Optional[str] = None  # raw category from CSV if present
    source_row: int  # original row number for debugging

class ParseSummary(BaseModel):
    total_rows: int
    parsed_rows: int
    skipped_rows: int
    total_amount: float
    date_range_start: Optional[str]
    date_range_end: Optional[str]
    warnings: list[str]

class ParsedUploadResponse(BaseModel):
    filename: str
    transactions: list[Transaction]
    summary: ParseSummary