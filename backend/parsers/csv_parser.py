import csv
import io
import uuid
from datetime import datetime
from typing import Optional
from models import Transaction, ParseSummary, ParsedUploadResponse

# Common column name aliases across different bank CSV formats
DATE_ALIASES = ["date", "transaction date", "trans date", "posted date", "posting date", "value date", "txn date"]
MERCHANT_ALIASES = ["merchant", "merchant name", "payee", "name", "vendor", "description name", "store"]
DESCRIPTION_ALIASES = ["description", "memo", "narrative", "details", "transaction description", "remarks", "reference", "particulars"]
AMOUNT_ALIASES = ["amount", "transaction amount", "debit", "credit", "sum", "value", "txn amount"]
CATEGORY_ALIASES = ["category", "type", "transaction type", "expense type", "classification"]


def normalize_header(h: str) -> str:
    return h.strip().lower().replace("_", " ").replace("-", " ")


def find_column(headers: list[str], aliases: list[str]) -> Optional[int]:
    normalized = [normalize_header(h) for h in headers]
    for alias in aliases:
        if alias in normalized:
            return normalized.index(alias)
    return None


def parse_amount(raw: str) -> Optional[float]:
    """Parse amount from various formats: $1,234.56 | (1234.56) | -1234.56"""
    if not raw:
        return None
    raw = raw.strip().replace(",", "").replace("$", "").replace(" ", "")
    # Parentheses = negative (accounting format)
    if raw.startswith("(") and raw.endswith(")"):
        raw = "-" + raw[1:-1]
    try:
        return float(raw)
    except ValueError:
        return None


def parse_date(raw: str) -> Optional[str]:
    """Try common date formats and return ISO string."""
    formats = [
        "%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y",
        "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%y",
        "%b %d, %Y", "%B %d, %Y", "%d %b %Y",
    ]
    raw = raw.strip()
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_csv_upload(contents: bytes, filename: str) -> ParsedUploadResponse:
    text = contents.decode("utf-8-sig", errors="replace")  # handle BOM
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise ValueError("CSV file is empty.")

    headers = rows[0]

    # Detect columns
    date_col = find_column(headers, DATE_ALIASES)
    merchant_col = find_column(headers, MERCHANT_ALIASES)
    desc_col = find_column(headers, DESCRIPTION_ALIASES)
    amount_col = find_column(headers, AMOUNT_ALIASES)
    category_col = find_column(headers, CATEGORY_ALIASES)

    if amount_col is None:
        raise ValueError(
            f"Could not find an amount column. Found columns: {headers}. "
            "Expected one of: amount, debit, credit, transaction amount."
        )

    # Check for split debit/credit columns (common in some bank formats)
    normalized = [normalize_header(h) for h in headers]
    debit_col = normalized.index("debit") if "debit" in normalized else None
    credit_col = normalized.index("credit") if "credit" in normalized else None
    has_split_amounts = (
        debit_col is not None and credit_col is not None and amount_col is None
    )

    transactions = []
    skipped = 0
    warnings = []
    dates = []

    for i, row in enumerate(rows[1:], start=2):
        if not any(cell.strip() for cell in row):
            skipped += 1
            continue  # skip blank rows

        # Pad short rows
        while len(row) < len(headers):
            row.append("")

        # Amount
        if has_split_amounts:
            debit = parse_amount(row[debit_col]) or 0.0
            credit = parse_amount(row[credit_col]) or 0.0
            amount = credit - debit  # positive = money in, negative = expense
        else:
            raw_amount = row[amount_col] if amount_col < len(row) else ""
            amount = parse_amount(raw_amount)
            if amount is None:
                warnings.append(f"Row {i}: Could not parse amount '{raw_amount}' — skipped.")
                skipped += 1
                continue

        # Date
        raw_date = row[date_col].strip() if date_col is not None and date_col < len(row) else ""
        parsed_date = parse_date(raw_date) if raw_date else None
        if raw_date and not parsed_date:
            warnings.append(f"Row {i}: Could not parse date '{raw_date}'.")
        if parsed_date:
            dates.append(parsed_date)

        # Merchant / description
        merchant = row[merchant_col].strip() if merchant_col is not None and merchant_col < len(row) else None
        description = row[desc_col].strip() if desc_col is not None and desc_col < len(row) else ""
        if not description and merchant:
            description = merchant
        elif not description:
            description = f"Transaction row {i}"

        category_hint = row[category_col].strip() if category_col is not None and category_col < len(row) else None

        transactions.append(Transaction(
            id=str(uuid.uuid4()),
            date=parsed_date,
            merchant=merchant,
            description=description,
            amount=amount,
            category_hint=category_hint,
            source_row=i,
        ))

    total_amount = sum(abs(t.amount) for t in transactions)
    dates_sorted = sorted(dates)

    summary = ParseSummary(
        total_rows=len(rows) - 1,
        parsed_rows=len(transactions),
        skipped_rows=skipped,
        total_amount=round(total_amount, 2),
        date_range_start=dates_sorted[0] if dates_sorted else None,
        date_range_end=dates_sorted[-1] if dates_sorted else None,
        warnings=warnings,
    )

    return ParsedUploadResponse(
        filename=filename,
        transactions=transactions,
        summary=summary,
    )