import uuid

import requests


def test_login_rate_limit(base_url):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"RateLimitTest {uuid.uuid4().hex}",
    }
    statuses = []
    for _ in range(11):
        response = requests.post(
            f"{base_url}/api/v1/auth/login",
            headers=headers,
            json={"email": "missing@example.com", "password": "WrongPassword123!"},
            timeout=10,
        )
        statuses.append(response.status_code)
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429
    assert response.headers["Retry-After"] == "60"
