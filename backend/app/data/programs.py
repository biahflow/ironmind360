"""Seis programas de preparação física complementar ao triatlo.

Cada programa contém 8 semanas × 2 sessões/semana = 16 sessões.
Sessões alternam entre A (agachamento-dominante) e B (hinge-dominante).
Semanas 4 e 8 são de redução (deload).
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# Helpers — mantêm as definições de sessão DRY
# ---------------------------------------------------------------------------

def _warmup(exercise_id: str, duration: int = 30) -> dict:
    return {
        "exercise_id": exercise_id,
        "phase": "warmup",
        "sets": 1,
        "duration_seconds": duration,
        "rest_seconds": 0,
    }


def _strength(exercise_id: str, sets: int, reps: str, rest: int,
              rpe: int, tempo: str | None = None, notes: str | None = None) -> dict:
    d: dict = {
        "exercise_id": exercise_id,
        "phase": "strength",
        "sets": sets,
        "reps": reps,
        "rest_seconds": rest,
        "rpe_target": rpe,
    }
    if tempo:
        d["tempo"] = tempo
    if notes:
        d["notes"] = notes
    return d


def _stability(exercise_id: str, sets: int, reps: str | None = None,
               duration: int | None = None, rest: int = 30,
               rpe: int | None = None, notes: str | None = None) -> dict:
    d: dict = {
        "exercise_id": exercise_id,
        "phase": "stability",
        "sets": sets,
        "rest_seconds": rest,
    }
    if reps:
        d["reps"] = reps
    if duration:
        d["duration_seconds"] = duration
    if rpe:
        d["rpe_target"] = rpe
    if notes:
        d["notes"] = notes
    return d


def _cooldown(exercise_id: str, duration: int = 30) -> dict:
    return {
        "exercise_id": exercise_id,
        "phase": "cooldown",
        "sets": 1,
        "duration_seconds": duration,
        "rest_seconds": 0,
    }


def _session(week: int, day: str, session_number: int, title: str,
             exercises: list[dict], is_deload: bool = False) -> dict:
    return {
        "week": week,
        "day": day,
        "session_number": session_number,
        "title": title,
        "is_deload": is_deload,
        "exercises": exercises,
    }


# ---------------------------------------------------------------------------
# Warmup blocks — reused across sessions
# ---------------------------------------------------------------------------

WARMUP_A_HOME = [
    _warmup("warmup-hip-circles", 30),
    _warmup("warmup-world-greatest-stretch", 30),
    _warmup("warmup-glute-bridge", 30),
    _warmup("warmup-cat-cow", 30),
]

WARMUP_A_GYM = [
    _warmup("warmup-hip-circles", 30),
    _warmup("warmup-world-greatest-stretch", 30),
    _warmup("warmup-miniband-lateral-walk", 30),
    _warmup("warmup-cat-cow", 30),
]

WARMUP_B_HOME = [
    _warmup("warmup-inchworm", 30),
    _warmup("warmup-lateral-lunge", 30),
    _warmup("warmup-glute-bridge", 30),
    _warmup("warmup-band-pull-apart", 30),
]

WARMUP_B_GYM = [
    _warmup("warmup-inchworm", 30),
    _warmup("warmup-lateral-lunge", 30),
    _warmup("warmup-miniband-lateral-walk", 30),
    _warmup("warmup-band-pull-apart", 30),
]

COOLDOWN_A = [
    _cooldown("mob-90-90-hip", 30),
    _cooldown("mob-couch-stretch", 30),
    _cooldown("mob-thoracic-rotation", 30),
]

COOLDOWN_B = [
    _cooldown("mob-pigeon-stretch", 30),
    _cooldown("mob-child-pose", 30),
    _cooldown("mob-foam-roll-thoracic", 30),
]


# ---------------------------------------------------------------------------
# Exercise selection tables per level × environment
# ---------------------------------------------------------------------------

# Session A exercises by level/env
SESSION_A = {
    ("beginner", "home"): {
        "squat_w1": "squat-bodyweight",
        "squat_w5": "squat-goblet",
        "row_w1": "row-band",
        "row_w5": "row-dumbbell-unilateral",
        "hinge_uni_w1": "hinge-single-leg-rdl-bw",
        "hinge_uni_w5": "hinge-single-leg-rdl-db",
        "push_w1": "push-incline-pushup",
        "push_w5": "push-pushup",
        "calf_w1": "calf-raise-standing",
        "calf_w5": "calf-raise-standing",
        "anti_rot_w1": "anti-rot-dead-bug",
        "anti_rot_w5": "anti-rot-pallof-press-band",
    },
    ("beginner", "gym"): {
        "squat_w1": "squat-box",
        "squat_w5": "squat-goblet",
        "row_w1": "row-dumbbell-unilateral",
        "row_w5": "row-cable",
        "hinge_uni_w1": "hinge-single-leg-rdl-bw",
        "hinge_uni_w5": "hinge-single-leg-rdl-db",
        "push_w1": "push-incline-pushup",
        "push_w5": "push-pushup",
        "calf_w1": "calf-raise-standing",
        "calf_w5": "calf-raise-seated-soleus",
        "anti_rot_w1": "anti-rot-dead-bug",
        "anti_rot_w5": "anti-rot-pallof-press-cable",
    },
    ("intermediate", "home"): {
        "squat_w1": "squat-goblet",
        "squat_w5": "squat-front-rack",
        "row_w1": "row-dumbbell-unilateral",
        "row_w5": "row-dumbbell-bilateral",
        "hinge_uni_w1": "hinge-single-leg-rdl-db",
        "hinge_uni_w5": "hinge-single-leg-rdl-kb",
        "push_w1": "push-pushup",
        "push_w5": "push-db-bench-press",
        "calf_w1": "calf-raise-weighted",
        "calf_w5": "calf-raise-seated-weighted",
        "anti_rot_w1": "anti-rot-pallof-press-band",
        "anti_rot_w5": "anti-rot-dead-bug-band",
    },
    ("intermediate", "gym"): {
        "squat_w1": "squat-goblet",
        "squat_w5": "squat-front-rack",
        "row_w1": "row-dumbbell-unilateral",
        "row_w5": "row-cable",
        "hinge_uni_w1": "hinge-single-leg-rdl-db",
        "hinge_uni_w5": "hinge-single-leg-rdl-kb",
        "push_w1": "push-pushup",
        "push_w5": "push-db-bench-press",
        "calf_w1": "calf-raise-weighted",
        "calf_w5": "calf-raise-seated-weighted",
        "anti_rot_w1": "anti-rot-pallof-press-cable",
        "anti_rot_w5": "anti-rot-pallof-press-cable",
    },
    ("advanced", "home"): {
        "squat_w1": "squat-front-rack",
        "squat_w5": "squat-front-rack",
        "row_w1": "row-dumbbell-bilateral",
        "row_w5": "row-dumbbell-bilateral",
        "hinge_uni_w1": "hinge-single-leg-rdl-db",
        "hinge_uni_w5": "hinge-single-leg-rdl-heavy",
        "push_w1": "push-pushup",
        "push_w5": "push-db-bench-press",
        "calf_w1": "calf-raise-weighted",
        "calf_w5": "calf-raise-seated-weighted",
        "anti_rot_w1": "anti-rot-dead-bug-band",
        "anti_rot_w5": "anti-rot-pallof-press-band",
    },
    ("advanced", "gym"): {
        "squat_w1": "squat-front-rack",
        "squat_w5": "squat-barbell-front",
        "row_w1": "row-dumbbell-bilateral",
        "row_w5": "row-barbell",
        "hinge_uni_w1": "hinge-single-leg-rdl-db",
        "hinge_uni_w5": "hinge-single-leg-rdl-heavy",
        "push_w1": "push-db-bench-press",
        "push_w5": "push-barbell-bench-press",
        "calf_w1": "calf-raise-weighted",
        "calf_w5": "calf-raise-seated-weighted",
        "anti_rot_w1": "anti-rot-pallof-press-cable",
        "anti_rot_w5": "anti-rot-pallof-press-cable",
    },
}

# Session B exercises by level/env
SESSION_B = {
    ("beginner", "home"): {
        "hinge_bi_w1": "hinge-hip-hinge-bw",
        "hinge_bi_w5": "hinge-rdl-db",
        "lunge_w1": "lunge-reverse-bw",
        "lunge_w5": "lunge-step-up",
        "pull_vert_w1": "pull-lat-pulldown-band",
        "pull_vert_w5": "pull-lat-pulldown-band",
        "push_vert_w1": "push-overhead-db-half-kneeling",
        "push_vert_w5": "push-overhead-db-half-kneeling",
        "posterior_w1": "prone-ywt",
        "posterior_w5": "face-pull-band",
        "lateral_w1": "anti-lat-side-plank",
        "lateral_w5": "carry-farmer-walk",
    },
    ("beginner", "gym"): {
        "hinge_bi_w1": "hinge-hip-hinge-bw",
        "hinge_bi_w5": "hinge-rdl-db",
        "lunge_w1": "lunge-reverse-bw",
        "lunge_w5": "lunge-step-up",
        "pull_vert_w1": "pull-lat-pulldown-cable",
        "pull_vert_w5": "pull-lat-pulldown-cable",
        "push_vert_w1": "push-overhead-db-half-kneeling",
        "push_vert_w5": "push-overhead-db-half-kneeling",
        "posterior_w1": "prone-ywt",
        "posterior_w5": "face-pull-cable",
        "lateral_w1": "anti-lat-side-plank",
        "lateral_w5": "carry-farmer-walk",
    },
    ("intermediate", "home"): {
        "hinge_bi_w1": "hinge-rdl-db",
        "hinge_bi_w5": "hinge-rdl-kb",
        "lunge_w1": "lunge-reverse-db",
        "lunge_w5": "lunge-step-up-db",
        "pull_vert_w1": "pull-lat-pulldown-band",
        "pull_vert_w5": "pull-lat-pulldown-band",
        "push_vert_w1": "push-overhead-db-half-kneeling",
        "push_vert_w5": "push-overhead-db-standing",
        "posterior_w1": "face-pull-band",
        "posterior_w5": "face-pull-band",
        "lateral_w1": "carry-farmer-walk",
        "lateral_w5": "carry-suitcase-walk",
    },
    ("intermediate", "gym"): {
        "hinge_bi_w1": "hinge-rdl-db",
        "hinge_bi_w5": "hinge-rdl-barbell",
        "lunge_w1": "lunge-reverse-db",
        "lunge_w5": "lunge-step-up-db",
        "pull_vert_w1": "pull-lat-pulldown-cable",
        "pull_vert_w5": "pull-chin-up-assisted",
        "push_vert_w1": "push-overhead-db-half-kneeling",
        "push_vert_w5": "push-overhead-db-standing",
        "posterior_w1": "face-pull-cable",
        "posterior_w5": "face-pull-cable",
        "lateral_w1": "carry-farmer-walk",
        "lateral_w5": "carry-suitcase-walk",
    },
    ("advanced", "home"): {
        "hinge_bi_w1": "hinge-rdl-kb",
        "hinge_bi_w5": "hinge-rdl-db",
        "lunge_w1": "lunge-reverse-db",
        "lunge_w5": "lunge-step-up-db",
        "pull_vert_w1": "pull-chin-up-assisted",
        "pull_vert_w5": "pull-chin-up",
        "push_vert_w1": "push-overhead-db-standing",
        "push_vert_w5": "push-overhead-db-standing",
        "posterior_w1": "face-pull-band",
        "posterior_w5": "hip-extension-band",
        "lateral_w1": "carry-suitcase-walk",
        "lateral_w5": "carry-overhead-walk",
    },
    ("advanced", "gym"): {
        "hinge_bi_w1": "hinge-rdl-barbell",
        "hinge_bi_w5": "hinge-deadlift-barbell",
        "lunge_w1": "lunge-reverse-db",
        "lunge_w5": "lunge-walking-db",
        "pull_vert_w1": "pull-chin-up-assisted",
        "pull_vert_w5": "pull-chin-up",
        "push_vert_w1": "push-overhead-db-standing",
        "push_vert_w5": "push-overhead-barbell",
        "posterior_w1": "face-pull-cable",
        "posterior_w5": "face-pull-cable",
        "lateral_w1": "carry-suitcase-walk",
        "lateral_w5": "carry-overhead-walk",
    },
}

# RPE / sets per week block
WEEK_PARAMS = {
    1: {"sets": 3, "rpe": 6, "stab_sets": 2},
    2: {"sets": 3, "rpe": 6, "stab_sets": 2},
    3: {"sets": 3, "rpe": 7, "stab_sets": 3},
    4: {"sets": 2, "rpe": 5, "stab_sets": 2},   # deload
    5: {"sets": 3, "rpe": 7, "stab_sets": 2},
    6: {"sets": 3, "rpe": 7, "stab_sets": 3},
    7: {"sets": 3, "rpe": 8, "stab_sets": 3},
    8: {"sets": 2, "rpe": 5, "stab_sets": 2},   # deload
}

# Reps prescription per level (normal / deload)
_REPS = {
    "beginner":     {"normal": "10-12", "deload": "10"},
    "intermediate": {"normal": "8-10",  "deload": "8"},
    "advanced":     {"normal": "6-8",   "deload": "8"},
}

_CALF_REPS = {
    "beginner":     {"normal": "12-15", "deload": "12"},
    "intermediate": {"normal": "12-15", "deload": "10"},
    "advanced":     {"normal": "10-12", "deload": "10"},
}

_STABILITY_REPS = "10-12"
_CARRY_DURATION = 30  # seconds


# ---------------------------------------------------------------------------
# Session builders
# ---------------------------------------------------------------------------

def _pick(table: dict, key: str, week: int) -> str:
    """Pick exercise ID from w1 or w5 variant based on week."""
    if week >= 5:
        return table[f"{key}_w5"]
    return table[f"{key}_w1"]


def _build_session_a(week: int, session_number: int, level: str, env: str) -> dict:
    tbl = SESSION_A[(level, env)]
    p = WEEK_PARAMS[week]
    is_deload = week in (4, 8)
    reps_key = "deload" if is_deload else "normal"
    reps = _REPS[level][reps_key]
    calf_reps = _CALF_REPS[level][reps_key]
    rest = 60 if level == "beginner" else 75 if level == "intermediate" else 90
    tempo = "3010" if level != "advanced" else "3011"

    warmup = WARMUP_A_GYM if env == "gym" else WARMUP_A_HOME
    title = f"Semana {week} — Sessão A"
    if is_deload:
        title += " (redução)"

    exercises = list(warmup) + [
        _strength(_pick(tbl, "squat", week), p["sets"], reps, rest, p["rpe"], tempo),
        _strength(_pick(tbl, "row", week), p["sets"], reps, rest, p["rpe"], tempo),
        _strength(_pick(tbl, "hinge_uni", week), p["sets"], reps, rest, p["rpe"], tempo,
                  notes="Cada lado"),
        _strength(_pick(tbl, "push", week), p["sets"], reps, rest, p["rpe"], tempo),
        _strength(_pick(tbl, "calf", week), p["sets"], calf_reps, 45, p["rpe"]),
        _stability(_pick(tbl, "anti_rot", week), p["stab_sets"], reps=_STABILITY_REPS,
                   rest=30, rpe=p["rpe"], notes="Cada lado"),
    ] + list(COOLDOWN_A)

    return _session(week, "A", session_number, title, exercises, is_deload)


def _build_session_b(week: int, session_number: int, level: str, env: str) -> dict:
    tbl = SESSION_B[(level, env)]
    p = WEEK_PARAMS[week]
    is_deload = week in (4, 8)
    reps_key = "deload" if is_deload else "normal"
    reps = _REPS[level][reps_key]
    rest = 60 if level == "beginner" else 75 if level == "intermediate" else 90
    tempo = "3010" if level != "advanced" else "3011"

    warmup = WARMUP_B_GYM if env == "gym" else WARMUP_B_HOME
    title = f"Semana {week} — Sessão B"
    if is_deload:
        title += " (redução)"

    lateral_key = _pick(tbl, "lateral", week)
    is_carry = lateral_key.startswith("carry-")

    exercises = list(warmup) + [
        _strength(_pick(tbl, "hinge_bi", week), p["sets"], reps, rest, p["rpe"], tempo),
        _strength(_pick(tbl, "lunge", week), p["sets"], reps, rest, p["rpe"], tempo,
                  notes="Cada lado"),
        _strength(_pick(tbl, "pull_vert", week), p["sets"], reps, rest, p["rpe"], tempo),
        _strength(_pick(tbl, "push_vert", week), p["sets"], reps, rest, p["rpe"], tempo),
        _stability(_pick(tbl, "posterior", week), p["stab_sets"], reps=_STABILITY_REPS,
                   rest=30, rpe=p["rpe"]),
        _stability(lateral_key, p["stab_sets"],
                   duration=_CARRY_DURATION if is_carry else None,
                   reps=None if is_carry else _STABILITY_REPS,
                   rest=30, rpe=p["rpe"],
                   notes="Cada lado"),
    ] + list(COOLDOWN_B)

    return _session(week, "B", session_number, title, exercises, is_deload)


def _build_program(program_id: str, name: str, level: str, env: str,
                   description: str) -> dict:
    sessions = []
    session_number = 0
    for week in range(1, 9):
        session_number += 1
        sessions.append(_build_session_a(week, session_number, level, env))
        session_number += 1
        sessions.append(_build_session_b(week, session_number, level, env))
    return {
        "id": program_id,
        "name": name,
        "level": level,
        "environment": env,
        "weeks": 8,
        "sessions_per_week": 2,
        "description": description,
        "sessions": sessions,
    }


# ---------------------------------------------------------------------------
# The six programs
# ---------------------------------------------------------------------------

PROGRAMS: list[dict] = [
    _build_program(
        "beginner_home",
        "Iniciante — Casa",
        "beginner", "home",
        "Programa de 8 semanas para iniciantes treinando em casa. "
        "Foco em padrões de movimento fundamentais com peso corporal, "
        "faixas elásticas e dumbbells leves. Duas sessões por semana.",
    ),
    _build_program(
        "beginner_gym",
        "Iniciante — Academia",
        "beginner", "gym",
        "Programa de 8 semanas para iniciantes na academia. "
        "Usa máquinas, cabos e banco para facilitar o aprendizado "
        "dos padrões de movimento. Duas sessões por semana.",
    ),
    _build_program(
        "intermediate_home",
        "Intermediário — Casa",
        "intermediate", "home",
        "Programa de 8 semanas para nível intermediário em casa. "
        "Dumbbells, kettlebells e faixas com progressão de carga e "
        "variações mais complexas. Duas sessões por semana.",
    ),
    _build_program(
        "intermediate_gym",
        "Intermediário — Academia",
        "intermediate", "gym",
        "Programa de 8 semanas para nível intermediário na academia. "
        "Inclui cabos, barra e puxada assistida com progressão "
        "estruturada de intensidade. Duas sessões por semana.",
    ),
    _build_program(
        "advanced_home",
        "Avançado — Casa",
        "advanced", "home",
        "Programa de 8 semanas para atletas avançados treinando em casa. "
        "Dumbbells pesados, kettlebells e barra fixa com foco em "
        "força e estabilidade funcional. Duas sessões por semana.",
    ),
    _build_program(
        "advanced_gym",
        "Avançado — Academia",
        "advanced", "gym",
        "Programa de 8 semanas para atletas avançados na academia. "
        "Barras, cabos e exercícios compostos com alta demanda "
        "neuromuscular. Duas sessões por semana.",
    ),
]

PROGRAMS_BY_ID: dict[str, dict] = {p["id"]: p for p in PROGRAMS}
