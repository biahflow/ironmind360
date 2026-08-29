"""Testes unitários do catálogo de exercícios e programas — sem dependência do ambiente."""

from app.data.exercise_catalog import EXERCISES, EXERCISES_BY_ID, CATALOG_VERSION
from app.data.programs import PROGRAMS, PROGRAMS_BY_ID
from app.models.exercise import ExerciseDefinition, ProgramDefinition


class TestCatalogIntegrity:
    def test_all_exercises_valid(self):
        for ex in EXERCISES:
            ExerciseDefinition(**ex)

    def test_unique_ids(self):
        ids = [e["id"] for e in EXERCISES]
        assert len(ids) == len(set(ids))

    def test_regressions_exist(self):
        for ex in EXERCISES:
            if ex.get("regression_id"):
                assert ex["regression_id"] in EXERCISES_BY_ID, (
                    f'{ex["id"]}: regression_id {ex["regression_id"]} não existe'
                )

    def test_progressions_exist(self):
        for ex in EXERCISES:
            if ex.get("progression_id"):
                assert ex["progression_id"] in EXERCISES_BY_ID, (
                    f'{ex["id"]}: progression_id {ex["progression_id"]} não existe'
                )

    def test_alternatives_exist(self):
        for ex in EXERCISES:
            for alt_id in ex.get("alternatives", []):
                assert alt_id in EXERCISES_BY_ID, (
                    f'{ex["id"]}: alternativa {alt_id} não existe'
                )

    def test_catalog_version_format(self):
        parts = CATALOG_VERSION.split(".")
        assert len(parts) == 3
        for p in parts:
            int(p)

    def test_minimum_exercise_count(self):
        assert len(EXERCISES) >= 60


class TestProgramIntegrity:
    def test_six_programs(self):
        assert len(PROGRAMS) == 6

    def test_all_level_environment_combinations(self):
        combos = {(p["level"], p["environment"]) for p in PROGRAMS}
        expected = {
            ("beginner", "home"), ("beginner", "gym"),
            ("intermediate", "home"), ("intermediate", "gym"),
            ("advanced", "home"), ("advanced", "gym"),
        }
        assert combos == expected

    def test_sixteen_sessions_per_program(self):
        for p in PROGRAMS:
            assert len(p["sessions"]) == 16, f'{p["id"]} tem {len(p["sessions"])} sessões'

    def test_alternating_ab_sessions(self):
        for p in PROGRAMS:
            for i, s in enumerate(p["sessions"]):
                expected = "A" if i % 2 == 0 else "B"
                assert s["day"] == expected, (
                    f'{p["id"]} sessão {s["session_number"]}: esperado {expected}, got {s["day"]}'
                )

    def test_deload_on_weeks_4_and_8(self):
        for p in PROGRAMS:
            deload_weeks = {s["week"] for s in p["sessions"] if s["is_deload"]}
            assert 4 in deload_weeks, f'{p["id"]}: semana 4 não é deload'
            assert 8 in deload_weeks, f'{p["id"]}: semana 8 não é deload'

    def test_all_exercise_ids_exist_in_catalog(self):
        for p in PROGRAMS:
            for s in p["sessions"]:
                for e in s["exercises"]:
                    assert e["exercise_id"] in EXERCISES_BY_ID, (
                        f'{p["id"]} sessão {s["session_number"]}: '
                        f'exercício {e["exercise_id"]} não existe no catálogo'
                    )

    def test_sessions_have_warmup_and_cooldown(self):
        for p in PROGRAMS:
            for s in p["sessions"]:
                phases = {e["phase"] for e in s["exercises"]}
                assert "warmup" in phases, (
                    f'{p["id"]} sessão {s["session_number"]} sem aquecimento'
                )
                assert "cooldown" in phases, (
                    f'{p["id"]} sessão {s["session_number"]} sem mobilidade final'
                )

    def test_sessions_have_strength(self):
        for p in PROGRAMS:
            for s in p["sessions"]:
                strength = [e for e in s["exercises"] if e["phase"] == "strength"]
                assert len(strength) >= 3, (
                    f'{p["id"]} sessão {s["session_number"]} com menos de 3 exercícios de força'
                )

    def test_no_bodybuilding_split(self):
        """Verificar que nenhum programa concentra só push ou só pull numa sessão."""
        for p in PROGRAMS:
            for s in p["sessions"]:
                strength = [e for e in s["exercises"] if e["phase"] == "strength"]
                patterns = set()
                for e in strength:
                    ex_def = EXERCISES_BY_ID.get(e["exercise_id"], {})
                    mp = ex_def.get("movement_pattern", "")
                    if mp.startswith("push") or mp.startswith("pull"):
                        patterns.add("push" if mp.startswith("push") else "pull")
                if len(patterns) >= 1:
                    assert len(patterns) >= 2 or len(strength) <= 3, (
                        f'{p["id"]} sessão {s["session_number"]} '
                        f'parece divisão de fisiculturismo: {patterns}'
                    )
