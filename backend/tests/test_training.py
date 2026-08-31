"""Testes E2E da Fase 2 — catálogo de exercícios, programas e execução de sessões."""

import pytest
import requests

V1 = "/api/v1"


class TestExerciseCatalog:
    def test_catalog_version(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/exercises/catalog/version", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "1.1.0"
        assert data["total_exercises"] >= 60

    def test_catalog_list_all(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/exercises/catalog", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 60
        ex = data["exercises"][0]
        assert "id" in ex
        assert "name" in ex
        assert "movement_pattern" in ex
        assert "instructions" in ex

    def test_catalog_filter_by_pattern(self, base_url, auth_headers, api_client):
        r = api_client.get(
            f"{base_url}{V1}/exercises/catalog", headers=auth_headers,
            params={"pattern": "squat"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 3
        for ex in data["exercises"]:
            assert ex["movement_pattern"] == "squat"

    def test_catalog_filter_by_equipment(self, base_url, auth_headers, api_client):
        r = api_client.get(
            f"{base_url}{V1}/exercises/catalog", headers=auth_headers,
            params={"equipment": "barbell"},
        )
        assert r.status_code == 200
        for ex in r.json()["exercises"]:
            assert "barbell" in ex["equipment"]

    def test_catalog_filter_by_level(self, base_url, auth_headers, api_client):
        r = api_client.get(
            f"{base_url}{V1}/exercises/catalog", headers=auth_headers,
            params={"level": "beginner"},
        )
        assert r.status_code == 200
        for ex in r.json()["exercises"]:
            assert ex["min_level"] == "beginner"

    def test_get_single_exercise(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/exercises/squat-goblet", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "squat-goblet"
        assert data["name"] == "Agachamento goblet"
        assert data["regression_id"] == "squat-bodyweight"
        assert data["progression_id"] == "squat-front-rack"

    def test_get_exercise_not_found(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/exercises/nonexistent", headers=auth_headers)
        assert r.status_code == 404

    def test_catalog_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}{V1}/exercises/catalog")
        assert r.status_code in (401, 403)


class TestPrograms:
    def test_list_programs(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/programs", headers=auth_headers)
        assert r.status_code == 200
        programs = r.json()["programs"]
        assert len(programs) == 6
        levels = {p["level"] for p in programs}
        assert levels == {"beginner", "intermediate", "advanced"}
        envs = {p["environment"] for p in programs}
        assert envs == {"home", "gym"}

    def test_get_program_detail(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/programs/beginner_home", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["level"] == "beginner"
        assert data["environment"] == "home"
        assert len(data["sessions"]) == 16

    def test_get_program_session_enriched(self, base_url, auth_headers, api_client):
        r = api_client.get(
            f"{base_url}{V1}/programs/beginner_home/sessions/1", headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["session_number"] == 1
        assert data["week"] == 1
        assert data["day"] == "A"
        for ex in data["exercises"]:
            assert "exercise" in ex
            assert ex["exercise"]["id"] == ex["exercise_id"]

    def test_deload_sessions(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/programs/beginner_home", headers=auth_headers)
        sessions = r.json()["sessions"]
        deload_weeks = {s["week"] for s in sessions if s["is_deload"]}
        assert 4 in deload_weeks
        assert 8 in deload_weeks

    def test_program_not_found(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/programs/nonexistent", headers=auth_headers)
        assert r.status_code == 404


class TestTrainingExecution:
    """Testa fluxo completo: iniciar programa → iniciar sessão → logar séries → completar."""

    def test_no_active_plan_initially(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/training/active", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["plan"] is None

    def test_full_session_flow(self, base_url, auth_headers, api_client):
        # 1. Iniciar programa
        r = api_client.post(
            f"{base_url}{V1}/training/start", headers=auth_headers,
            json={"program_id": "beginner_home", "session_number": 1},
        )
        assert r.status_code == 200
        plan = r.json()["plan"]
        assert plan["program_id"] == "beginner_home"
        assert plan["status"] == "active"
        assert plan["current_session"] == 1

        # 2. Verificar plano ativo
        r = api_client.get(f"{base_url}{V1}/training/active", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["plan"]["program_id"] == "beginner_home"

        # 3. Não permitir segundo programa ativo
        r = api_client.post(
            f"{base_url}{V1}/training/start", headers=auth_headers,
            json={"program_id": "beginner_gym", "session_number": 1},
        )
        assert r.status_code == 409

        # 4. Iniciar sessão de treino
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/start", headers=auth_headers,
        )
        assert r.status_code == 200
        session = r.json()["session"]
        assert session["status"] == "in_progress"
        assert session["session_number"] == 1
        assert r.json()["resumed"] is False

        # 5. Retomar sessão existente
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/start", headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["resumed"] is True

        # 6. Logar séries
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/log-set", headers=auth_headers,
            json={
                "exercise_id": "squat-bodyweight",
                "set_number": 1,
                "reps": 10,
                "rpe": 6,
            },
        )
        assert r.status_code == 200
        assert r.json()["logged"] is True

        # 7. Logar segunda série do mesmo exercício
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/log-set", headers=auth_headers,
            json={
                "exercise_id": "squat-bodyweight",
                "set_number": 2,
                "reps": 10,
                "weight_kg": 0,
                "rpe": 7,
                "pain": 0,
            },
        )
        assert r.status_code == 200

        # 8. Atualizar série existente (autosave)
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/log-set", headers=auth_headers,
            json={
                "exercise_id": "squat-bodyweight",
                "set_number": 1,
                "reps": 12,
                "rpe": 7,
                "notes": "Melhor que esperado",
            },
        )
        assert r.status_code == 200

        # 9. Completar sessão
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/complete", headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["completed"] is True
        assert r.json()["session_number"] == 1

        # 10. Plano avançou para sessão 2
        r = api_client.get(f"{base_url}{V1}/training/active", headers=auth_headers)
        plan = r.json()["plan"]
        assert plan["current_session"] == 2
        assert plan["completed_sessions"] == 1
        assert plan["status"] == "active"

        # 11. Histórico mostra sessão concluída
        r = api_client.get(f"{base_url}{V1}/training/history", headers=auth_headers)
        assert r.status_code == 200
        sessions = r.json()["sessions"]
        assert len(sessions) >= 1
        assert sessions[0]["status"] == "completed"
        assert sessions[0]["session_number"] == 1
        assert r.json()["source"] == "ironmind"

        # 12. Pular sessão
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/skip", headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["skipped"] is True

        r = api_client.get(f"{base_url}{V1}/training/active", headers=auth_headers)
        assert r.json()["plan"]["current_session"] == 3

        # 13. Cancelar programa
        r = api_client.post(f"{base_url}{V1}/training/cancel", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["cancelled"] is True

        # 14. Sem plano ativo
        r = api_client.get(f"{base_url}{V1}/training/active", headers=auth_headers)
        assert r.json()["plan"] is None

    def test_log_set_without_session(self, base_url, auth_headers, api_client):
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/log-set", headers=auth_headers,
            json={"exercise_id": "squat-goblet", "set_number": 1, "reps": 10},
        )
        assert r.status_code == 404

    def test_complete_without_session(self, base_url, auth_headers, api_client):
        r = api_client.post(
            f"{base_url}{V1}/training/sessions/complete", headers=auth_headers,
        )
        assert r.status_code == 404

    def test_restart_plan(self, base_url, auth_headers, api_client):
        # Iniciar um programa
        api_client.post(f"{base_url}{V1}/training/cancel", headers=auth_headers)
        r = api_client.post(
            f"{base_url}{V1}/training/start", headers=auth_headers,
            json={"program_id": "beginner_home", "session_number": 1},
        )
        assert r.status_code == 200

        # Completar uma sessão para avançar
        api_client.post(f"{base_url}{V1}/training/sessions/start", headers=auth_headers)
        api_client.post(f"{base_url}{V1}/training/sessions/complete", headers=auth_headers)

        r = api_client.get(f"{base_url}{V1}/training/active", headers=auth_headers)
        assert r.json()["plan"]["current_session"] == 2

        # Reiniciar volta à sessão 1
        r = api_client.post(f"{base_url}{V1}/training/restart", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["restarted"] is True
        assert r.json()["program_id"] == "beginner_home"

        r = api_client.get(f"{base_url}{V1}/training/active", headers=auth_headers)
        plan = r.json()["plan"]
        assert plan["current_session"] == 1
        assert plan["completed_sessions"] == 0
        assert plan["status"] == "active"

        # Limpar
        api_client.post(f"{base_url}{V1}/training/cancel", headers=auth_headers)

    def test_restart_without_plan(self, base_url, auth_headers, api_client):
        api_client.post(f"{base_url}{V1}/training/cancel", headers=auth_headers)
        r = api_client.post(f"{base_url}{V1}/training/restart", headers=auth_headers)
        assert r.status_code == 404

    def test_cancel_without_plan(self, base_url, auth_headers, api_client):
        # Garantir que não há plano ativo
        api_client.post(f"{base_url}{V1}/training/cancel", headers=auth_headers)
        r = api_client.post(f"{base_url}{V1}/training/cancel", headers=auth_headers)
        assert r.status_code == 404


class TestCustomWorkout:
    def _two_exercise_ids(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/exercises/catalog", headers=auth_headers)
        exercises = r.json()["exercises"]
        return [exercises[0]["id"], exercises[1]["id"]]

    def _clear_session(self, base_url, auth_headers, api_client):
        # Finaliza qualquer sessão em andamento para isolar o teste.
        api_client.post(f"{base_url}{V1}/training/sessions/complete", headers=auth_headers)

    def test_custom_start_resume_and_complete(self, base_url, auth_headers, api_client):
        self._clear_session(base_url, auth_headers, api_client)
        ids = self._two_exercise_ids(base_url, auth_headers, api_client)
        payload = {
            "title": "Treino Teste",
            "items": [
                {"exercise_id": ids[0], "sets": 3, "reps": "10", "rest_seconds": 60},
                {"exercise_id": ids[1], "sets": 4, "reps": "8", "rest_seconds": 90},
            ],
        }
        r = api_client.post(f"{base_url}{V1}/training/custom/start", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        session = r.json()["session"]
        assert session["custom"] is True
        assert session["title"] == "Treino Teste"
        assert len(session["prescription"]) == 2
        assert session["prescription"][0]["exercise"]["id"] == ids[0]
        assert session["prescription"][0]["sets"] == 3

        # sessions/start retoma a sessão custom (sem exigir plano)
        resume = api_client.post(f"{base_url}{V1}/training/sessions/start", headers=auth_headers)
        assert resume.status_code == 200
        assert resume.json()["session"]["custom"] is True

        # completa (limpa o estado)
        done = api_client.post(f"{base_url}{V1}/training/sessions/complete", headers=auth_headers)
        assert done.status_code == 200
        assert done.json()["completed"] is True

    def test_custom_rejects_when_session_active(self, base_url, auth_headers, api_client):
        self._clear_session(base_url, auth_headers, api_client)
        ids = self._two_exercise_ids(base_url, auth_headers, api_client)
        item = {"items": [{"exercise_id": ids[0], "sets": 2, "reps": "10", "rest_seconds": 45}]}
        first = api_client.post(f"{base_url}{V1}/training/custom/start", headers=auth_headers, json=item)
        assert first.status_code == 200
        second = api_client.post(f"{base_url}{V1}/training/custom/start", headers=auth_headers, json=item)
        assert second.status_code == 409
        # limpeza
        self._clear_session(base_url, auth_headers, api_client)

    def test_custom_invalid_exercise(self, base_url, auth_headers, api_client):
        self._clear_session(base_url, auth_headers, api_client)
        payload = {"items": [{"exercise_id": "nao-existe-xyz", "sets": 3, "reps": "10", "rest_seconds": 60}]}
        r = api_client.post(f"{base_url}{V1}/training/custom/start", headers=auth_headers, json=payload)
        assert r.status_code == 400
