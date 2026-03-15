import io
import os
import re
import base64
from PIL import Image
import pytesseract
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def extract_text_from_image(image_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(image_bytes))
    text = pytesseract.image_to_string(image)
    return text.strip()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    from pdf2image import convert_from_bytes
    images = convert_from_bytes(pdf_bytes)
    full_text = ""
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        full_text += pytesseract.image_to_string(Image.open(buf)) + "\n"
    return full_text.strip()


def parse_receipt_with_ai(raw_text: str) -> dict:
    prompt = f"""You are a receipt parsing assistant. Extract structured data from this receipt text.

Receipt text:
{raw_text}

Respond ONLY with a JSON object, no other text:
{{
  "merchant": "store or business name",
  "date": "YYYY-MM-DD or null if not found",
  "total": numeric total amount as a number or null,
  "subtotal": numeric subtotal or null,
  "tax": numeric tax amount or null,
  "payment_method": "cash/card/unknown",
  "line_items": [
    {{"description": "item name", "amount": numeric amount}}
  ],
  "business_purpose_hint": "one sentence guess at whether this is business or personal based on items"
}}"""

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}]
    )

    import json
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def match_receipt_to_transaction(receipt: dict, transactions: list) -> dict | None:
    """Try to find a matching transaction for this receipt."""
    if not receipt.get("total") or not transactions:
        return None

    receipt_amount = abs(float(receipt["total"]))
    receipt_merchant = (receipt.get("merchant") or "").lower()

    best_match = None
    best_score = 0

    for tx in transactions:
        tx_amount = abs(tx.get("amount", 0))
        tx_desc = (tx.get("description") or "").lower()

        score = 0

        # Amount match (within $1)
        if abs(tx_amount - receipt_amount) <= 1.0:
            score += 50
        elif abs(tx_amount - receipt_amount) <= 5.0:
            score += 20

        # Merchant name overlap
        if receipt_merchant and receipt_merchant[:5] in tx_desc:
            score += 40
        elif receipt_merchant and any(word in tx_desc for word in receipt_merchant.split() if len(word) > 3):
            score += 20

        # Date match
        if receipt.get("date") and tx.get("date") == receipt["date"]:
            score += 20

        if score > best_score and score >= 40:
            best_score = score
            best_match = tx

    return best_match


def process_receipt(file_bytes: bytes, content_type: str, transactions: list = []) -> dict:
    # Extract raw text
    if content_type == "application/pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    else:
        raw_text = extract_text_from_image(file_bytes)

    if not raw_text or len(raw_text) < 10:
        return {
            "success": False,
            "error": "Could not extract text from this file. Try a clearer image.",
            "raw_text": raw_text
        }

    # Parse with AI
    parsed = parse_receipt_with_ai(raw_text)

    # Try to match to a transaction
    matched_tx = match_receipt_to_transaction(parsed, transactions)

    return {
        "success": True,
        "raw_text": raw_text,
        "parsed": parsed,
        "matched_transaction_id": matched_tx["id"] if matched_tx else None,
        "matched_transaction_description": matched_tx["description"] if matched_tx else None,
    }