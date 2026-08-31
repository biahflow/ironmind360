V1 = "/api/v1"


class TestRaces:
    def test_create_list_and_delete(self, base_url, auth_headers, api_client):
        payload = {
            "name": "Prova de Teste E2E",
            "race_type": "olympic",
            "priority": "A",
            "date": "2026-12-01",
            "location": "Florianópolis",
            "goal": "sub 2h30",
        }
        r = api_client.post(f"{base_url}{V1}/races", headers=auth_headers, json=payload)
        assert r.status_code == 201, r.text
        created = r.json()
        rid = created["id"]
        assert created["name"] == payload["name"]
        assert created["race_type"] == "olympic"

        # aparece na listagem
        lst = api_client.get(f"{base_url}{V1}/races", headers=auth_headers)
        assert lst.status_code == 200
        assert any(x["id"] == rid for x in lst.json()["races"])

        # remove (limpa o estado)
        d = api_client.delete(f"{base_url}{V1}/races/{rid}", headers=auth_headers)
        assert d.status_code in (200, 204)

    def test_invalid_date_rejected(self, base_url, auth_headers, api_client):
        payload = {"name": "Data errada", "race_type": "sprint", "date": "01/12/2026"}
        r = api_client.post(f"{base_url}{V1}/races", headers=auth_headers, json=payload)
        assert r.status_code == 422

    def test_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}{V1}/races")
        assert r.status_code == 401


class TestRaceDetail:
    def _make_race(self, base_url, auth_headers, api_client):
        r = api_client.post(
            f"{base_url}{V1}/races", headers=auth_headers,
            json={"name": "Prova Detalhe E2E", "race_type": "olympic", "date": "2026-11-10"},
        )
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def test_checklist_strategy_retrospective_flow(self, base_url, auth_headers, api_client):
        rid = self._make_race(base_url, auth_headers, api_client)
        try:
            # checklist default + toggle
            c = api_client.get(f"{base_url}{V1}/races/{rid}/checklist", headers=auth_headers)
            assert c.status_code == 200
            items = c.json()["checklist"]
            assert len(items) > 0
            t = api_client.put(f"{base_url}{V1}/races/{rid}/checklist/0/toggle", headers=auth_headers)
            assert t.status_code == 200
            assert t.json()["checklist"][0]["checked"] is True

            # estrategia
            sp = api_client.put(
                f"{base_url}{V1}/races/{rid}/strategy", headers=auth_headers,
                json={"swim_pace_per_100m": "1:45", "bike_power_watts": 210, "fueling_plan": "1 gel/30min"},
            )
            assert sp.status_code == 200
            sg = api_client.get(f"{base_url}{V1}/races/{rid}/strategy", headers=auth_headers)
            assert sg.json()["strategy"]["bike_power_watts"] == 210

            # retrospectiva
            rp = api_client.put(
                f"{base_url}{V1}/races/{rid}/retrospective", headers=auth_headers,
                json={"overall_rating": 5, "finish_time": "2:28:10", "what_went_well": "pacing"},
            )
            assert rp.status_code == 200
            rg = api_client.get(f"{base_url}{V1}/races/{rid}/retrospective", headers=auth_headers)
            assert rg.json()["retrospective"]["overall_rating"] == 5
        finally:
            api_client.delete(f"{base_url}{V1}/races/{rid}", headers=auth_headers)

    def test_detail_not_found(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/races/000000000000000000000000/checklist", headers=auth_headers)
        assert r.status_code == 404
