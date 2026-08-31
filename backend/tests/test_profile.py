import base64

import requests

V1 = "/api/v1"

# PNG 1x1 valido
PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


class TestProfileAvatar:
    def test_upload_serve_expose_and_delete(self, base_url, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}

        # upload
        r = requests.put(
            f"{base_url}{V1}/profile/avatar",
            headers=h,
            files={"file": ("avatar.png", PNG_1x1, "image/png")},
        )
        assert r.status_code == 200, r.text
        url = r.json()["avatar_url"]
        assert url.startswith("/api/v1/files/")

        # arquivo servido com autenticacao
        served = requests.get(f"{base_url}{url}", headers=h)
        assert served.status_code == 200
        assert served.headers.get("content-type", "").startswith("image/")

        # exposto em /auth/me
        me = requests.get(f"{base_url}{V1}/auth/me", headers=h)
        assert me.status_code == 200
        assert me.json().get("avatar_url") == url

        # remocao
        d = requests.delete(f"{base_url}{V1}/profile/avatar", headers=h)
        assert d.status_code == 200
        me2 = requests.get(f"{base_url}{V1}/auth/me", headers=h)
        assert me2.json().get("avatar_url") in (None, "")

    def test_reject_non_image(self, base_url, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}
        r = requests.put(
            f"{base_url}{V1}/profile/avatar",
            headers=h,
            files={"file": ("nota.txt", b"nao sou imagem", "text/plain")},
        )
        assert r.status_code == 400

    def test_requires_auth(self, base_url):
        r = requests.put(
            f"{base_url}{V1}/profile/avatar",
            files={"file": ("avatar.png", PNG_1x1, "image/png")},
        )
        assert r.status_code == 401
