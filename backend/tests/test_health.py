"""E2E tests for health documents API (requires running stack)."""
import io
import time
import requests
import pytest


class TestHealthDocuments:
    """Tests for /api/v1/health endpoints."""

    @pytest.fixture(scope="class")
    def pdf_bytes(self):
        """Minimal valid PDF for testing."""
        return (
            b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
            b"xref\n0 4\n0000000000 65535 f \n"
            b"0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
            b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
        )

    @pytest.fixture(scope="class")
    def jpeg_bytes(self):
        """Minimal valid JPEG for testing."""
        return (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xd9"
        )

    def test_upload_pdf(self, base_url, auth_headers, pdf_bytes):
        files = {"file": ("exame.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        r = requests.post(
            f"{base_url}/api/v1/health/documents",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files,
            data={"title": "Hemograma Teste"},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["id"]
        assert data["file_id"]
        assert data["status"] == "uploaded"
        assert data["content_type"] == "application/pdf"
        self.__class__._doc_id = data["id"]
        self.__class__._file_id = data["file_id"]

    def test_upload_jpeg(self, base_url, auth_headers, jpeg_bytes):
        files = {"file": ("exame.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")}
        r = requests.post(
            f"{base_url}/api/v1/health/documents",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files,
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["content_type"] == "image/jpeg"
        self.__class__._jpeg_doc_id = data["id"]

    def test_upload_invalid_signature(self, base_url, auth_headers):
        fake_pdf = b"NOT A REAL PDF"
        files = {"file": ("fake.pdf", io.BytesIO(fake_pdf), "application/pdf")}
        r = requests.post(
            f"{base_url}/api/v1/health/documents",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files,
        )
        assert r.status_code == 400
        msg = r.json().get("error", {}).get("message", "").lower()
        assert "assinatura" in msg

    def test_upload_unsupported_type(self, base_url, auth_headers):
        files = {"file": ("doc.docx", io.BytesIO(b"fake"), "application/vnd.openxmlformats")}
        r = requests.post(
            f"{base_url}/api/v1/health/documents",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files,
        )
        assert r.status_code == 400

    def test_list_documents(self, base_url, auth_headers):
        r = requests.get(
            f"{base_url}/api/v1/health/documents",
            headers=auth_headers,
        )
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        assert len(docs) >= 1
        assert all("id" in d and "status" in d for d in docs)

    def test_get_document(self, base_url, auth_headers):
        doc_id = self.__class__._doc_id
        r = requests.get(
            f"{base_url}/api/v1/health/documents/{doc_id}",
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == doc_id

    def test_get_document_not_found(self, base_url, auth_headers):
        r = requests.get(
            f"{base_url}/api/v1/health/documents/nonexistent-id",
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_get_markers_empty_initially(self, base_url, auth_headers):
        doc_id = self.__class__._doc_id
        r = requests.get(
            f"{base_url}/api/v1/health/documents/{doc_id}/markers",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delete_document(self, base_url, auth_headers):
        jpeg_id = self.__class__._jpeg_doc_id
        r = requests.delete(
            f"{base_url}/api/v1/health/documents/{jpeg_id}",
            headers=auth_headers,
        )
        assert r.status_code == 204

        r2 = requests.get(
            f"{base_url}/api/v1/health/documents/{jpeg_id}",
            headers=auth_headers,
        )
        assert r2.status_code == 404

    def test_delete_not_found(self, base_url, auth_headers):
        r = requests.delete(
            f"{base_url}/api/v1/health/documents/nonexistent",
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_trends_empty(self, base_url, auth_headers):
        r = requests.get(
            f"{base_url}/api/v1/health/trends/Hemoglobina",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_idor_document(self, base_url, api_client):
        """Another user cannot access health documents."""
        suffix = int(time.time())
        email = f"health_idor_{suffix}@ironmind.app"
        pw = "TestPass123!"
        r = api_client.post(
            f"{base_url}/api/auth/register",
            json={"email": email, "password": pw, "name": "IDOR User"},
        )
        assert r.status_code == 200
        other_token = r.json()["token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}

        doc_id = self.__class__._doc_id
        r2 = requests.get(
            f"{base_url}/api/v1/health/documents/{doc_id}",
            headers=other_headers,
        )
        assert r2.status_code == 404

    def test_cleanup(self, base_url, auth_headers):
        doc_id = self.__class__._doc_id
        requests.delete(
            f"{base_url}/api/v1/health/documents/{doc_id}",
            headers=auth_headers,
        )
