"""Sanitize live WorkBuddy billing metadata and evaluate scheduled promotions."""
from datetime import datetime, timezone
import math
import re


def multiplier(label: object) -> float | None:
    """Parse an explicit upstream credit multiplier; missing values remain unknown."""
    if not isinstance(label, str):
        return None
    match = re.fullmatch(r"(?:x(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)x)(?: credits)?", label.strip())
    if not match:
        return None
    value = float(match.group(1) or match.group(2))
    return value if math.isfinite(value) else None


def timestamp(value: object) -> datetime:
    """Parse a string timestamp, normalizing UTC Z for Python 3.10; return datetime or raise ValueError."""
    if not isinstance(value, str):
        raise ValueError("Promotion timestamp must be a string")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    return datetime.fromisoformat(normalized)


def active_promotion(promotion: dict, model_id: str, now: datetime) -> bool:
    """Require explicit model membership and a valid, currently active absolute schedule."""
    model_ids = promotion.get("modelIds")
    if promotion.get("enabled") is not True or not isinstance(model_ids, list) or model_id not in model_ids:
        return False
    schedule = promotion.get("schedule")
    if not isinstance(schedule, dict) or set(schedule) - {"timezone", "validFrom", "validUntil"}:
        return False
    try:
        start = timestamp(schedule["validFrom"])
        end = timestamp(schedule["validUntil"])
        return start.tzinfo is not None and end.tzinfo is not None and start <= now < end
    except (KeyError, ValueError, TypeError):
        return False


def billing(model: dict, promotions: list, now: datetime | None = None) -> dict:
    """Return only a model's explicit billing label and active promotion, without secrets."""
    now = now or datetime.now(timezone.utc)
    label = model.get("credits", "")
    rate = multiplier(label)
    result = {"label": label if rate is not None else "", "multiplier": rate,
              "free": rate == 0, "promotionEndsAt": "", "promotionText": "", "promotionTextZh": ""}
    eligible = [item for item in promotions if isinstance(item, dict)
                and active_promotion(item, model["id"], now)]
    eligible.sort(key=lambda item: item.get("priority", 0) if isinstance(item.get("priority", 0), (int, float)) else 0, reverse=True)
    if not eligible:
        return result
    promotion = eligible[0]
    discount = promotion.get("discount") or {}
    if not isinstance(discount, dict):
        return result
    if discount.get("factor") == 0 and not isinstance(discount.get("factor"), bool):
        result.update(free=True, multiplier=0, label="x0.00")
    elif multiplier(discount.get("discountedCredits")) is not None:
        rate = multiplier(discount["discountedCredits"])
        result.update(free=rate == 0, multiplier=rate, label=discount["discountedCredits"])
    result["promotionEndsAt"] = promotion["schedule"]["validUntil"]
    hover = promotion.get("hover") or {}
    if isinstance(hover, dict):
        result["promotionText"] = str(hover.get("textEn") or hover.get("textZh") or "")[:1000]
        result["promotionTextZh"] = str(hover.get("textZh") or hover.get("textEn") or "")[:1000]
    return result
