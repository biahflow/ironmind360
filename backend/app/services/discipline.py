def compute_discipline(
    habits: dict | None, meals_count: int, workout_today: bool, goals: dict
) -> int:
    score = 30 if workout_today else 0
    water = (habits or {}).get("water_ml") or 0
    score += min(20, int(20 * water / max(goals.get("water_ml", 3000), 1)))
    sleep = (habits or {}).get("sleep_hours") or 0
    score += min(15, int(15 * sleep / max(goals.get("sleep_hours", 7.5), 1)))
    if meals_count:
        score += min(15, 5 * meals_count)
    extras = sum(
        bool((habits or {}).get(name)) for name in ("meditate", "read", "cold_shower")
    )
    score += int(20 * extras / 3)
    return min(100, score)
