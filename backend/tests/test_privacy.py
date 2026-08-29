import os
import uuid

import requests
from pymongo import MongoClient


def test_consent_export_and_permanent_deletion(base_url):
    email = f"privacy-{uuid.uuid4().hex}@example.com"
    password = "PrivacyTest123!"
    registered = requests.post(
        f"{base_url}/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Privacy Test"},
        timeout=15,
    )
    assert registered.status_code == 200, registered.text
    body = registered.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}

    granted = requests.post(
        f"{base_url}/api/v1/privacy/consents",
        headers=headers,
        json={"purpose": "health_data", "version": "2026-08-29.v1"},
        timeout=10,
    )
    assert granted.status_code == 201, granted.text
    listed = requests.get(
        f"{base_url}/api/v1/privacy/consents", headers=headers, timeout=10
    ).json()
    assert listed["consents"][0]["status"] == "granted"
    revoked = requests.delete(
        f"{base_url}/api/v1/privacy/consents/health_data", headers=headers, timeout=10
    )
    assert revoked.status_code == 200

    exported = requests.get(f"{base_url}/api/v1/account/export", headers=headers, timeout=10)
    assert exported.status_code == 200
    assert exported.headers["Cache-Control"] == "private, no-store"
    export_body = exported.json()
    assert export_body["user"]["email"] == email
    assert "password_hash" not in export_body["user"]
    assert "intervals_api_key" not in export_body["user"]
    assert len(export_body["consents"]) == 2

    mongo = MongoClient(os.environ["MONGO_URL"])
    database = mongo[os.environ["DB_NAME"]]
    audits = list(database.audit_events.find({"actor_user_id": body["user"]["id"]}))
    assert {item["action"] for item in audits} >= {
        "consent.granted",
        "consent.revoked",
        "account.exported",
    }
    assert all("content" not in item and "email" not in item for item in audits)

    wrong = requests.post(
        f"{base_url}/api/v1/account/delete",
        headers=headers,
        json={"password": "wrong"},
        timeout=10,
    )
    assert wrong.status_code == 401
    deleted = requests.post(
        f"{base_url}/api/v1/account/delete",
        headers=headers,
        json={"password": password},
        timeout=10,
    )
    assert deleted.status_code == 200, deleted.text
    assert database.users.count_documents({"email": email}) == 0
    assert database.consents.count_documents({"user_id": body["user"]["id"]}) == 0
    relogin = requests.post(
        f"{base_url}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    assert relogin.status_code == 401
    mongo.close()
