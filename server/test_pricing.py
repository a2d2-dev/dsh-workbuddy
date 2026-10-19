"""Verify free labels follow explicit billing and active upstream promotion dates."""
from datetime import datetime, timezone
import pytest
from pricing import billing, multiplier


@pytest.mark.parametrize("label, expected", [("x0.00", 0), ("0.00x", 0), ("x0.03", 0.03),
                                            ("x0.34 credits", 0.34), ("", None), (None, None), (False, None)])
def test_multiplier_requires_explicit_numeric_metadata(label, expected):
    """Unknown or missing prices must never become free by default."""
    assert multiplier(label) == expected


def test_only_current_enabled_model_promotions_are_applied():
    """Free promotions have inclusive starts and exclusive ends, tied to exact IDs."""
    model = {"id": "model", "credits": "x0.03"}
    promotion = {"enabled": True, "modelIds": ["model"], "priority": 100,
                 "discount": {"factor": 0}, "schedule": {"timezone": "Asia/Shanghai",
                 "validFrom": "2026-10-12T00:00:00+08:00", "validUntil": "2026-10-26T00:00:00+08:00"}}
    active = datetime(2026, 10, 16, tzinfo=timezone.utc)
    assert billing(model, [promotion], active)["free"] is True
    assert billing(model, [promotion], datetime.fromisoformat(promotion["schedule"]["validUntil"]))["free"] is False
    assert billing({**model, "id": "model-sg"}, [promotion], active)["free"] is False
    assert billing(model, [{**promotion, "enabled": False}], active)["free"] is False
    assert billing(model, [{**promotion, "schedule": {}}], active)["free"] is False
    assert billing(model, [{**promotion, "modelIds": "model-sg"}], active)["free"] is False
    assert billing(model, [{**promotion, "modelIds": None}], active)["free"] is False


def test_unknown_price_stays_unknown_and_secrets_are_not_forwarded():
    """Public billing consists only of known display fields."""
    result = billing({"id": "auto", "credits": "", "apiKey": "secret"}, [])
    assert result["multiplier"] is None and result["free"] is False
    assert "apiKey" not in result


def test_promotions_preserve_both_languages_without_changing_billing():
    """Given bilingual promotion copy, keep English/Chinese text and the upstream price independent."""
    promotion = {"enabled": True, "modelIds": ["model"], "discount": {"discountedCredits": "x0.03"},
                 "schedule": {"validFrom": "2026-01-01T00:00:00Z", "validUntil": "2027-01-01T00:00:00Z"},
                 "hover": {"textEn": "English promotion", "textZh": "中文活动"}}
    current = datetime(2026, 10, 19, tzinfo=timezone.utc)
    result = billing({"id": "model", "credits": "x0.1"}, [promotion], current)
    assert result["promotionText"] == "English promotion"
    assert result["promotionTextZh"] == "中文活动"
    assert result["free"] is False and result["multiplier"] == 0.03
    promotion["hover"] = {"textZh": "中文活动"}
    assert billing({"id": "model"}, [promotion], current)["promotionText"] == "中文活动"
    promotion["hover"] = {"textEn": "English promotion"}
    assert billing({"id": "model"}, [promotion], current)["promotionTextZh"] == "English promotion"
