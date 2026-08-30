"""Testes E2E de equipamentos e planos de prova."""

import pytest


class TestEquipment:
    def test_create_equipment(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/equipment",
            json={
                "name": "Asics Gel-Nimbus 26",
                "category": "shoes",
                "brand": "Asics",
                "model": "Gel-Nimbus 26",
                "max_distance_km": 800,
                "maintenance_interval_km": 400,
                "activity_types": ["Run"],
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Asics Gel-Nimbus 26"
        assert data["category"] == "shoes"
        assert data["total_distance_km"] == 0
        assert "id" in data
        self.__class__._equip_id = data["id"]

    def test_list_equipment(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/equipment", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()["equipment"]) >= 1

    def test_get_equipment(self, base_url, api_client, auth_headers):
        eid = getattr(self.__class__, "_equip_id", None)
        if not eid:
            pytest.skip("Equipamento nao criado")
        r = api_client.get(f"{base_url}/api/v1/equipment/{eid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "Asics Gel-Nimbus 26"

    def test_update_equipment(self, base_url, api_client, auth_headers):
        eid = getattr(self.__class__, "_equip_id", None)
        if not eid:
            pytest.skip("Equipamento nao criado")
        r = api_client.put(
            f"{base_url}/api/v1/equipment/{eid}",
            json={
                "name": "Asics Gel-Nimbus 26 v2",
                "category": "shoes",
                "brand": "Asics",
                "model": "Gel-Nimbus 26",
                "max_distance_km": 800,
                "activity_types": ["Run"],
            },
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Asics Gel-Nimbus 26 v2"

    def test_add_usage(self, base_url, api_client, auth_headers):
        eid = getattr(self.__class__, "_equip_id", None)
        if not eid:
            pytest.skip("Equipamento nao criado")
        r = api_client.post(
            f"{base_url}/api/v1/equipment/{eid}/add-usage?distance_km=50&hours=5",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["total_distance_km"] == 50

    def test_log_maintenance(self, base_url, api_client, auth_headers):
        eid = getattr(self.__class__, "_equip_id", None)
        if not eid:
            pytest.skip("Equipamento nao criado")
        r = api_client.post(
            f"{base_url}/api/v1/equipment/{eid}/maintenance?description=Troca de palmilha",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["entry"]["description"] == "Troca de palmilha"

    def test_alerts(self, base_url, api_client, auth_headers):
        eid = getattr(self.__class__, "_equip_id", None)
        if not eid:
            pytest.skip("Equipamento nao criado")
        r = api_client.get(f"{base_url}/api/v1/equipment/{eid}/alerts", headers=auth_headers)
        assert r.status_code == 200
        assert "alerts" in r.json()

    def test_delete_equipment(self, base_url, api_client, auth_headers):
        eid = getattr(self.__class__, "_equip_id", None)
        if not eid:
            pytest.skip("Equipamento nao criado")
        r = api_client.delete(f"{base_url}/api/v1/equipment/{eid}", headers=auth_headers)
        assert r.status_code == 200

    def test_idor_equipment(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/equipment/000000000000000000000000",
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_equipment_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/v1/equipment")
        assert r.status_code in (401, 403)


class TestRaceChecklist:
    @classmethod
    def _create_race(cls, base_url, api_client, auth_headers, name="Teste E2E"):
        r = api_client.post(
            f"{base_url}/api/v1/races",
            json={"name": name, "race_type": "sprint", "date": "2027-01-15"},
            headers=auth_headers,
        )
        assert r.status_code == 201
        return r.json()["id"]

    def test_get_default_checklist(self, base_url, api_client, auth_headers):
        rid = self._create_race(base_url, api_client, auth_headers, "Checklist Test")
        self.__class__._race_id = rid
        r = api_client.get(f"{base_url}/api/v1/races/{rid}/checklist", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["checklist"]
        assert len(items) >= 10
        assert all(not i["checked"] for i in items)

    def test_toggle_checklist_item(self, base_url, api_client, auth_headers):
        rid = getattr(self.__class__, "_race_id", None)
        if not rid:
            pytest.skip("Prova nao criada")
        r = api_client.put(
            f"{base_url}/api/v1/races/{rid}/checklist/0/toggle", headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["checklist"][0]["checked"] is True

    def test_update_checklist(self, base_url, api_client, auth_headers):
        rid = getattr(self.__class__, "_race_id", None)
        if not rid:
            pytest.skip("Prova nao criada")
        r = api_client.put(
            f"{base_url}/api/v1/races/{rid}/checklist",
            json={"items": [{"text": "Item custom", "category": "test", "checked": False}]},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert len(r.json()["checklist"]) == 1


class TestRaceStrategy:
    def test_get_empty_strategy(self, base_url, api_client, auth_headers):
        rid = TestRaceChecklist._create_race(base_url, api_client, auth_headers, "Strategy Test")
        self.__class__._race_id = rid
        r = api_client.get(f"{base_url}/api/v1/races/{rid}/strategy", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["strategy"] == {}

    def test_update_strategy(self, base_url, api_client, auth_headers):
        rid = getattr(self.__class__, "_race_id", None)
        if not rid:
            pytest.skip("Prova nao criada")
        r = api_client.put(
            f"{base_url}/api/v1/races/{rid}/strategy",
            json={
                "swim_pace_per_100m": "2:00",
                "run_pace_per_km": "5:30",
                "fueling_plan": "Gel a cada 45 min",
            },
            headers=auth_headers,
        )
        assert r.status_code == 200
        s = r.json()["strategy"]
        assert s["swim_pace_per_100m"] == "2:00"
        assert s["fueling_plan"] == "Gel a cada 45 min"


class TestRaceRetrospective:
    def test_update_retrospective(self, base_url, api_client, auth_headers):
        rid = TestRaceChecklist._create_race(base_url, api_client, auth_headers, "Retro Test")
        self.__class__._race_id = rid
        r = api_client.put(
            f"{base_url}/api/v1/races/{rid}/retrospective",
            json={
                "overall_rating": 4,
                "what_went_well": "Natação rápida",
                "what_to_improve": "Transição lenta",
                "finish_time": "2:45:00",
            },
            headers=auth_headers,
        )
        assert r.status_code == 200
        retro = r.json()["retrospective"]
        assert retro["overall_rating"] == 4
        assert retro["finish_time"] == "2:45:00"

    def test_get_retrospective(self, base_url, api_client, auth_headers):
        rid = getattr(self.__class__, "_race_id", None)
        if not rid:
            pytest.skip("Prova nao criada")
        r = api_client.get(f"{base_url}/api/v1/races/{rid}/retrospective", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["retrospective"]["overall_rating"] == 4


class TestDuplicatePlan:
    def test_duplicate_plan(self, base_url, api_client, auth_headers):
        src = TestRaceChecklist._create_race(base_url, api_client, auth_headers, "Source")
        api_client.put(
            f"{base_url}/api/v1/races/{src}/checklist",
            json={"items": [{"text": "Item A", "category": "test", "checked": True}]},
            headers=auth_headers,
        )
        api_client.put(
            f"{base_url}/api/v1/races/{src}/strategy",
            json={"fueling_plan": "Gel a cada 30 min"},
            headers=auth_headers,
        )
        tgt = TestRaceChecklist._create_race(base_url, api_client, auth_headers, "Target")
        r = api_client.post(
            f"{base_url}/api/v1/races/{src}/duplicate-plan-to/{tgt}",
            headers=auth_headers,
        )
        assert r.status_code == 200

        cl = api_client.get(f"{base_url}/api/v1/races/{tgt}/checklist", headers=auth_headers)
        assert cl.json()["checklist"][0]["text"] == "Item A"
        assert cl.json()["checklist"][0]["checked"] is False

        st = api_client.get(f"{base_url}/api/v1/races/{tgt}/strategy", headers=auth_headers)
        assert st.json()["strategy"]["fueling_plan"] == "Gel a cada 30 min"
