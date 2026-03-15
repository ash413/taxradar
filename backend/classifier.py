import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# --- Rules layer: known merchants we can classify instantly ---
MERCHANT_RULES = {
    # Software & SaaS
    "adobe": ("Software & SaaS", "deductible", 0.97),
    "zoom": ("Software & SaaS", "deductible", 0.97),
    "notion": ("Software & SaaS", "deductible", 0.97),
    "github": ("Software & SaaS", "deductible", 0.97),
    "dropbox": ("Software & SaaS", "deductible", 0.95),
    "slack": ("Software & SaaS", "deductible", 0.97),
    "figma": ("Software & SaaS", "deductible", 0.97),
    "aws": ("Software & SaaS", "deductible", 0.95),
    "amazon web": ("Software & SaaS", "deductible", 0.95),
    "google cloud": ("Software & SaaS", "deductible", 0.95),
    "digitalocean": ("Software & SaaS", "deductible", 0.95),
    "linear": ("Software & SaaS", "deductible", 0.97),
    "vercel": ("Software & SaaS", "deductible", 0.97),
    "netlify": ("Software & SaaS", "deductible", 0.97),
    # Professional development
    "linkedin": ("Professional Development", "deductible", 0.90),
    "coursera": ("Professional Development", "deductible", 0.90),
    "udemy": ("Professional Development", "deductible", 0.90),
    "skillshare": ("Professional Development", "deductible", 0.88),
    # Travel
    "uber": ("Travel & Transportation", "likely deductible", 0.75),
    "lyft": ("Travel & Transportation", "likely deductible", 0.75),
    "delta": ("Travel & Transportation", "likely deductible", 0.80),
    "united": ("Travel & Transportation", "likely deductible", 0.80),
    "american airlines": ("Travel & Transportation", "likely deductible", 0.80),
    "hertz": ("Travel & Transportation", "likely deductible", 0.78),
    "airbnb": ("Travel & Transportation", "likely deductible", 0.72),
    # Office
    "wework": ("Office & Workspace", "deductible", 0.95),
    "staples": ("Office Supplies", "likely deductible", 0.82),
    "office depot": ("Office Supplies", "likely deductible", 0.82),
    # Meals (partial)
    "starbucks": ("Meals & Entertainment", "partially deductible", 0.70),
    "mcdonalds": ("Meals & Entertainment", "review needed", 0.50),
    "doordash": ("Meals & Entertainment", "partially deductible", 0.60),
    # Non-deductible
    "netflix": ("Entertainment", "non-deductible", 0.90),
    "spotify": ("Entertainment", "non-deductible", 0.90),
    "wegmans": ("Groceries", "non-deductible", 0.92),
    "walmart": ("Groceries", "review needed", 0.60),
    "target": ("General Retail", "review needed", 0.55),
}

DEDUCTION_BUCKETS = {
    "Software & SaaS": "Business Software & Subscriptions",
    "Professional Development": "Education & Professional Development",
    "Travel & Transportation": "Business Travel",
    "Office & Workspace": "Rent & Office Expenses",
    "Office Supplies": "Office Supplies & Materials",
    "Meals & Entertainment": "Meals & Entertainment (50% deductible)",
    "Entertainment": "Personal — Not Deductible",
    "Groceries": "Personal — Not Deductible",
    "General Retail": "Requires Review",
}


def classify_with_rules(description: str):
    desc_lower = description.lower()
    for keyword, (category, eligibility, confidence) in MERCHANT_RULES.items():
        if keyword in desc_lower:
            return category, eligibility, confidence
    return None


def classify_with_ai(description: str, amount: float, date: str):
    prompt = f"""You are a tax classification assistant for freelancers and small business owners in the US.

Classify this transaction and respond ONLY with a JSON object, no other text.

Transaction:
- Description: {description}
- Amount: ${amount}
- Date: {date}

Respond with exactly this JSON structure:
{{
  "category": "short category name",
  "eligibility": "one of: deductible | likely deductible | partially deductible | review needed | non-deductible",
  "confidence": a number between 0.0 and 1.0,
  "reason": "one sentence explaining why"
}}"""

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def classify_transaction(description: str, amount: float, date: str = "unknown"):
    # Layer 1: rules
    rules_result = classify_with_rules(description)

    if rules_result:
        category, eligibility, confidence = rules_result
        deduction_bucket = DEDUCTION_BUCKETS.get(category, "Requires Review")
        return {
            "category": category,
            "eligibility": eligibility,
            "confidence": confidence,
            "deduction_bucket": deduction_bucket,
            "reason": f"Matched known merchant pattern for {category}.",
            "source": "rules"
        }

    # Layer 2: AI
    try:
        ai_result = classify_with_ai(description, amount, date)
        category = ai_result.get("category", "Uncategorized")
        deduction_bucket = DEDUCTION_BUCKETS.get(category, "Requires Review")
        return {
            "category": category,
            "eligibility": ai_result.get("eligibility", "review needed"),
            "confidence": ai_result.get("confidence", 0.5),
            "deduction_bucket": deduction_bucket,
            "reason": ai_result.get("reason", ""),
            "source": "ai"
        }
    except Exception as e:
        return {
            "category": "Uncategorized",
            "eligibility": "review needed",
            "confidence": 0.0,
            "deduction_bucket": "Requires Review",
            "reason": f"Classification failed: {str(e)}",
            "source": "error"
        }