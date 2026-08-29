import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
# Also load frontend .env to get EXPO_PUBLIC_BACKEND_URL if needed
FE_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
if FE_ENV.exists():
    load_dotenv(FE_ENV)

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"

DEMO_EMAIL = "demo@ironmind.app"
DEMO_PW = "Goggins@43"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": DEMO_EMAIL, "password": DEMO_PW}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
