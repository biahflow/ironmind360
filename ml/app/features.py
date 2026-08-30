"""Pipeline de features para os modelos preditivos da Fase 5.

Funções puras (recebem listas de documentos já carregadas) + um loader que lê
do Mongo por ``user_id`` e janela. Manter puro o núcleo facilita testar a
matemática (ex.: ACWR) sem depender do banco.

Fontes de dados disponíveis hoje:
  - ``activities``          → carga (``icu_training_load``, i.e. TSS), FC, duração.
  - ``habits``             → sono e escalas subjetivas (fadiga, estresse, energia).
  - ``training_sessions``  → RPE por série das sessões de força concluídas.

HRV e FC de repouso ainda não existem no modelo de dados; ficam como colunas
opcionais nulas (placeholder para quando o wellness do intervals.icu for
sincronizado).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from statistics import mean
from typing import Any, Iterable

FEATURE_SCHEMA_VERSION = "1.0.0"

ACUTE_DAYS = 7
CHRONIC_DAYS = 28


# ── coerção de datas ────────────────────────────────────────────
def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and len(value) >= 10:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _num(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


# ── série diária de carga ───────────────────────────────────────
def daily_load_series(activities: Iterable[dict], as_of: date, days: int) -> list[float]:
    """Carga diária dos últimos ``days`` dias (inclui zeros nos dias sem treino)."""
    totals: dict[date, float] = {}
    for act in activities:
        d = _as_date(act.get("start_date_local"))
        if d is None:
            continue
        load = _num(act.get("icu_training_load")) or 0.0
        totals[d] = totals.get(d, 0.0) + load
    start = as_of - timedelta(days=days - 1)
    return [totals.get(start + timedelta(days=i), 0.0) for i in range(days)]


def compute_acwr(activities: Iterable[dict], as_of: date) -> dict[str, Any]:
    """ACWR (Acute:Chronic Workload Ratio) a partir da carga TSS.

    Usa médias diárias: aguda = média dos últimos 7 dias, crônica = média dos
    últimos 28 dias. Retorna ``acwr`` nulo quando não há carga crônica.
    """
    acts = list(activities)
    acute_series = daily_load_series(acts, as_of, ACUTE_DAYS)
    chronic_series = daily_load_series(acts, as_of, CHRONIC_DAYS)

    acute_daily = mean(acute_series) if acute_series else 0.0
    chronic_daily = mean(chronic_series) if chronic_series else 0.0
    acwr = round(acute_daily / chronic_daily, 3) if chronic_daily > 0 else None

    return {
        "acute_load_7d": round(sum(acute_series), 1),
        "chronic_load_28d": round(sum(chronic_series), 1),
        "acute_daily": round(acute_daily, 2),
        "chronic_daily": round(chronic_daily, 2),
        "acwr": acwr,
        "acwr_zone": _acwr_zone(acwr),
        "active_days_28d": sum(1 for v in chronic_series if v > 0),
    }


def _acwr_zone(acwr: float | None) -> str | None:
    """Zona descritiva do ACWR (referência de literatura de carga de treino).

    Não é diagnóstico nem classificação de risco final (isso é do Bloco 2);
    apenas rotula a faixa do ratio.
    """
    if acwr is None:
        return None
    if acwr < 0.8:
        return "baixa"
    if acwr <= 1.3:
        return "otima"
    if acwr <= 1.5:
        return "elevada"
    return "alta"


# ── recuperação subjetiva / sono ────────────────────────────────
def _window(docs: Iterable[dict], as_of: date, days: int, date_key: str) -> list[dict]:
    start = as_of - timedelta(days=days - 1)
    out = []
    for doc in docs:
        d = _as_date(doc.get(date_key))
        if d is not None and start <= d <= as_of:
            out.append(doc)
    return out


def _mean_field(docs: list[dict], field: str) -> float | None:
    vals = [v for v in (_num(doc.get(field)) for doc in docs) if v is not None]
    return round(mean(vals), 2) if vals else None


def recovery_features(habits: Iterable[dict], as_of: date, days: int = ACUTE_DAYS) -> dict[str, Any]:
    window = _window(habits, as_of, days, "date")
    return {
        "sleep_hours_avg": _mean_field(window, "sleep_hours"),
        "sleep_quality_avg": _mean_field(window, "sleep_quality"),
        "fatigue_avg": _mean_field(window, "fatigue"),
        "stress_avg": _mean_field(window, "stress"),
        "energy_avg": _mean_field(window, "energy"),
        "motivation_avg": _mean_field(window, "motivation"),
        "checkins_7d": len(window),
    }


# ── RPE das sessões de força ────────────────────────────────────
def session_rpe_features(sessions: Iterable[dict], as_of: date, days: int = ACUTE_DAYS) -> dict[str, Any]:
    window = _window(
        (s for s in sessions if s.get("status") == "completed"), as_of, days, "completed_at"
    )
    rpes: list[float] = []
    for sess in window:
        for ex in sess.get("exercises", []) or []:
            for st in ex.get("sets", []) or []:
                rpe = _num(st.get("rpe"))
                if rpe is not None:
                    rpes.append(rpe)
    return {
        "strength_sessions_7d": len(window),
        "set_rpe_avg_7d": round(mean(rpes), 2) if rpes else None,
        "set_count_7d": len(rpes),
    }


# ── agregação final ─────────────────────────────────────────────
def extract_features(
    *,
    activities: Iterable[dict],
    habits: Iterable[dict],
    sessions: Iterable[dict],
    as_of: date | None = None,
) -> dict[str, Any]:
    as_of = as_of or date.today()
    load = compute_acwr(activities, as_of)
    recovery = recovery_features(habits, as_of)
    strength = session_rpe_features(sessions, as_of)

    return {
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "as_of": as_of.isoformat(),
        "load": load,
        "recovery": recovery,
        "strength": strength,
        # Placeholders para quando o wellness do intervals.icu for sincronizado.
        "hrv_avg_7d": None,
        "resting_hr_avg_7d": None,
    }


# ── loader (lê do Mongo) ────────────────────────────────────────
def load_features(db, user_id: str, as_of: date | None = None, chronic_days: int = CHRONIC_DAYS) -> dict[str, Any]:
    """Carrega os documentos relevantes do usuário e extrai as features."""
    as_of = as_of or date.today()
    oldest = (as_of - timedelta(days=chronic_days + 1)).isoformat()

    activities = list(
        db.activities.find(
            {"user_id": user_id, "start_date_local": {"$gte": oldest}},
            {"start_date_local": 1, "icu_training_load": 1, "_id": 0},
        )
    )
    habits = list(
        db.habits.find(
            {"user_id": user_id, "date": {"$gte": oldest}},
            {"date": 1, "sleep_hours": 1, "sleep_quality": 1, "fatigue": 1,
             "stress": 1, "energy": 1, "motivation": 1, "_id": 0},
        )
    )
    sessions = list(
        db.training_sessions.find(
            {"user_id": user_id, "status": "completed"},
            {"completed_at": 1, "status": 1, "exercises": 1, "_id": 0},
        )
    )

    features = extract_features(
        activities=activities, habits=habits, sessions=sessions, as_of=as_of
    )
    features["source_counts"] = {
        "activities": len(activities),
        "habits": len(habits),
        "sessions": len(sessions),
    }
    return features
