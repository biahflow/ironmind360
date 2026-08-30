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
