"""Testes E2E do coach: conversas, relatórios, diário, respiração, reflexões."""

import pytest


class TestCoachConversations:
    def test_create_conversation(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/coach/conversations",
            json={"title": "Teste E2E"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "Teste E2E"
        assert "id" in data
        self.__class__._conv_id = data["id"]

    def test_list_conversations(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/conversations", headers=auth_headers
        )
        assert r.status_code == 200
        convs = r.json()["conversations"]
        assert any(c["title"] == "Teste E2E" for c in convs)

    def test_delete_conversation(self, base_url, api_client, auth_headers):
        conv_id = getattr(self.__class__, "_conv_id", None)
        if not conv_id:
            pytest.skip("Conversa nao criada")
        r = api_client.delete(
            f"{base_url}/api/v1/coach/conversations/{conv_id}",
            headers=auth_headers,
        )
        assert r.status_code == 200

    def test_delete_nonexistent_conversation(self, base_url, api_client, auth_headers):
        r = api_client.delete(
            f"{base_url}/api/v1/coach/conversations/000000000000000000000000",
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_clear_all_conversations(self, base_url, api_client, auth_headers):
        api_client.post(
            f"{base_url}/api/v1/coach/conversations",
            json={"title": "Para limpar"},
            headers=auth_headers,
        )
        r = api_client.delete(
            f"{base_url}/api/v1/coach/conversations", headers=auth_headers
        )
        assert r.status_code == 200


class TestCoachHistory:
    def test_get_history_empty(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/history", headers=auth_headers
        )
        assert r.status_code == 200
        assert "messages" in r.json()

    def test_get_history_by_conversation(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/history?conversation_id=000000000000000000000000",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["messages"] == []


class TestCoachReports:
    def test_list_reports(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/reports", headers=auth_headers
        )
        assert r.status_code == 200
        assert "reports" in r.json()

    def test_toggle_action_not_found(self, base_url, api_client, auth_headers):
        r = api_client.put(
            f"{base_url}/api/v1/coach/reports/000000000000000000000000/actions/0",
            headers=auth_headers,
        )
        assert r.status_code == 404


class TestCoachDiary:
    def test_create_diary_entry(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/coach/diary",
            json={"content": "Hoje treinei bem, sinto progresso.", "mood": 4, "tags": ["treino"]},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["content"] == "Hoje treinei bem, sinto progresso."
        assert data["mood"] == 4
        assert "id" in data
        self.__class__._entry_id = data["id"]

    def test_list_diary(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/diary", headers=auth_headers
        )
        assert r.status_code == 200
        entries = r.json()["entries"]
        assert len(entries) >= 1

    def test_delete_diary_entry(self, base_url, api_client, auth_headers):
        entry_id = getattr(self.__class__, "_entry_id", None)
        if not entry_id:
            pytest.skip("Entrada nao criada")
        r = api_client.delete(
            f"{base_url}/api/v1/coach/diary/{entry_id}", headers=auth_headers
        )
        assert r.status_code == 200

    def test_delete_diary_not_found(self, base_url, api_client, auth_headers):
        r = api_client.delete(
            f"{base_url}/api/v1/coach/diary/000000000000000000000000",
            headers=auth_headers,
        )
        assert r.status_code == 404


class TestCoachBreathing:
    def test_list_techniques(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/breathing/techniques", headers=auth_headers
        )
        assert r.status_code == 200
        techs = r.json()["techniques"]
        assert len(techs) >= 3
        assert any(t["key"] == "box_breathing" for t in techs)

    def test_log_breathing(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/coach/breathing/log",
            json={"technique": "box_breathing", "duration_seconds": 300, "completed": True},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["technique"] == "box_breathing"
        assert data["duration_seconds"] == 300

    def test_breathing_history(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/breathing/history", headers=auth_headers
        )
        assert r.status_code == 200
        assert len(r.json()["sessions"]) >= 1


class TestCoachReflections:
    def test_list_prompts(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/reflections/prompts", headers=auth_headers
        )
        assert r.status_code == 200
        prompts = r.json()["prompts"]
        assert len(prompts) >= 5

    def test_create_reflection(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/coach/reflections",
            json={"prompt_key": "gratitude", "response": "Grato pela saude, familia e treino."},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["prompt_key"] == "gratitude"
        assert "id" in data
        self.__class__._ref_id = data["id"]

    def test_list_reflections(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/coach/reflections", headers=auth_headers
        )
        assert r.status_code == 200
        assert len(r.json()["reflections"]) >= 1

    def test_delete_reflection(self, base_url, api_client, auth_headers):
        ref_id = getattr(self.__class__, "_ref_id", None)
        if not ref_id:
            pytest.skip("Reflexao nao criada")
        r = api_client.delete(
            f"{base_url}/api/v1/coach/reflections/{ref_id}", headers=auth_headers
        )
        assert r.status_code == 200

    def test_delete_reflection_not_found(self, base_url, api_client, auth_headers):
        r = api_client.delete(
            f"{base_url}/api/v1/coach/reflections/000000000000000000000000",
            headers=auth_headers,
        )
        assert r.status_code == 404


class TestCoachAuth:
    def test_endpoints_require_auth(self, base_url, api_client):
        endpoints = [
            ("GET", "/coach/conversations"),
            ("POST", "/coach/conversations"),
            ("GET", "/coach/history"),
            ("POST", "/coach/diary"),
            ("GET", "/coach/diary"),
            ("GET", "/coach/breathing/history"),
            ("GET", "/coach/reflections"),
            ("GET", "/coach/reports"),
        ]
        for method, path in endpoints:
            r = getattr(api_client, method.lower())(
                f"{base_url}/api/v1{path}", headers={"Content-Type": "application/json"}
            )
            assert r.status_code in (401, 403, 422), f"{method} {path} returned {r.status_code}"
