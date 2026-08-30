V1 = "/api/v1"


class TestBarcodeLookup:
    def test_invalid_code_rejected(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}{V1}/nutrition/barcode/abc", headers=auth_headers)
        assert r.status_code == 400

    def test_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}{V1}/nutrition/barcode/7891000100103")
        assert r.status_code == 401
