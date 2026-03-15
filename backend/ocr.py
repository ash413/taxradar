import io
import os
import json
import base64
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def encode_image(image_bytes: bytes, content_type: str) -> str:
    return base64.standard_b64encode(image_bytes).decode("utf-8")


def parse_receipt_with_vision(image_bytes: bytes, content_type: str) -> dict:
    base64_image = encode_image(image_bytes, content_type)

    # Map content type to what Claude expects
    media_type_map = {
        "image/jpeg": "image/jpeg",
        "image/jpg": "image/jpeg",
        "image/png": "image/png",
        "image/webp": "image/webp",
    }
    media_type = media_type_map.get(content_type, "image/jpeg")

    prompt = """You are a receipt parsing assistant. Look at this receipt image carefully and extract all information.

Respond ONLY with a JSON object, no other text:
{
  "merchant": "store or business name",
  "date": "YYYY-MM-DD or null if not found",
  "total": numeric total amount as a number or null,
  "subtotal": numeric subtotal or null,
  "tax": numeric tax amount or null,
  "payment_method": "cash/card/unknown",
  "line_items": [
    {"description": "item name", "amount": numeric amount or null}
  ],
  "business_purpose_hint": "one sentence: is this business or personal based on the items?"
}"""

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": base64_image,
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }]
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def match_receipt_to_transaction(receipt: dict, transactions: list) -> dict | None:
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

        if abs(tx_amount - receipt_amount) <= 1.0:
            score += 50
        elif abs(tx_amount - receipt_amount) <= 5.0:
            score += 20

        if receipt_merchant and receipt_merchant[:5] in tx_desc:
            score += 40
        elif receipt_merchant and any(word in tx_desc for word in receipt_merchant.split() if len(word) > 3):
            score += 20

        if receipt.get("date") and tx.get("date") == receipt["date"]:
            score += 20

        if score > best_score and score >= 40:
            best_score = score
            best_match = tx

    return best_match


def process_receipt(file_bytes: bytes, content_type: str, transactions: list = []) -> dict:
    # PDFs: extract first page as image
    if content_type == "application/pdf":
        try:
            from pdf2image import convert_from_bytes
            from PIL import Image
            images = convert_from_bytes(file_bytes)
            buf = io.BytesIO()
            images[0].save(buf, format="PNG")
            image_bytes = buf.getvalue()
            content_type = "image/png"
        except Exception as e:
            return {"success": False, "error": f"Could not process PDF: {str(e)}"}
    else:
        image_bytes = file_bytes

    try:
        parsed = parse_receipt_with_vision(image_bytes, content_type)
    except Exception as e:
        return {"success": False, "error": f"Vision parsing failed: {str(e)}"}

    matched_tx = match_receipt_to_transaction(parsed, transactions)

    return {
        "success": True,
        "parsed": parsed,
        "matched_transaction_id": matched_tx["id"] if matched_tx else None,
        "matched_transaction_description": matched_tx["description"] if matched_tx else None,
    }