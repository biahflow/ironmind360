"""Full backend E2E tests for IronMind 360 API."""
import io
import os
import time
import base64
import requests
import pytest


# ---------------- Auth ----------------
class TestAuth:
    def test_root(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "operational"

    def test_login_demo(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": "demo@ironmind.app", "password": "Goggins@43"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == "demo@ironmind.app"

    def test_login_wrong_password(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": "demo@ironmind.app", "password": "wrongpw"})
        assert r.status_code == 401

    def test_me_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "demo@ironmind.app"
        assert "goals" in u
        assert u["intervals_connected"] is False

    def test_register_and_login_new(self, base_url, api_client):
        suffix = int(time.time())
        email = f"TEST_user_{suffix}@ironmind.app"
        pw = "TestPass123!"
        r = api_client.post(f"{base_url}/api/auth/register",
                            json={"email": email, "password": pw, "name": "TEST User"})
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # Verify /me
        r2 = requests.get(f"{base_url}/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert r2.json()["email"] == email.lower()

    def test_register_duplicate(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/auth/register",
                            json={"email": "demo@ironmind.app", "password": "whatever", "name": "Dup"})
        assert r.status_code == 409


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard_shape(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ("discipline_score", "streak", "daily_challenge", "goals",
                    "workout_today", "weekly_load", "weekly_km",
                    "water_ml", "meals_count", "intervals_connected"):
            assert key in d, f"missing key {key}"
        assert isinstance(d["discipline_score"], int)
        assert 0 <= d["discipline_score"] <= 100
        assert d["intervals_connected"] is False


# ---------------- Habits ----------------
class TestHabits:
    def test_get_habits_default(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/habits", headers=auth_headers)
        assert r.status_code == 200

    def test_upsert_habits_and_score_rises(self, base_url, auth_headers):
        # Get baseline dashboard score
        d0 = requests.get(f"{base_url}/api/dashboard", headers=auth_headers).json()
        base_score = d0["discipline_score"]

        # Fill today's habits with all positives
        today = d0["date"]
        payload = {
            "date": today,
            "water_ml": 3000,
            "sleep_hours": 7.5,
            "meditate": True,
            "read": True,
            "cold_shower": True,
            "mood": 4,
            "anxiety": 2,
        }
        r = requests.put(f"{base_url}/api/habits", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        h = r.json()
        assert h["water_ml"] == 3000
        assert h["meditate"] is True
        assert h["cold_shower"] is True

        # GET verify persistence
        r2 = requests.get(f"{base_url}/api/habits?date={today}", headers=auth_headers)
        assert r2.status_code == 200
        h2 = r2.json()
        assert h2["water_ml"] == 3000
        assert h2["sleep_hours"] == 7.5

        # Dashboard score should rise significantly
        d1 = requests.get(f"{base_url}/api/dashboard", headers=auth_headers).json()
        assert d1["discipline_score"] >= base_score, "score should not decrease after check-ins"
        assert d1["discipline_score"] >= 50, f"expected notable score after full habits, got {d1['discipline_score']}"
        assert d1["water_ml"] == 3000
        assert d1["meditate"] is True


# ---------------- Settings ----------------
class TestSettings:
    def test_get_settings(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/settings", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "demo@ironmind.app"

    def test_update_goals(self, base_url, auth_headers):
        payload = {"goals": {"calories": 2400, "protein": 160, "water_ml": 3200, "sleep_hours": 8.0}}
        r = requests.put(f"{base_url}/api/settings", headers=auth_headers, json=payload)
        assert r.status_code == 200
        assert r.json()["goals"]["calories"] == 2400
        # revert
        requests.put(f"{base_url}/api/settings", headers=auth_headers,
                     json={"goals": {"calories": 2200, "protein": 150, "water_ml": 3000, "sleep_hours": 7.5}})


# ---------------- Intervals / Workouts ----------------
class TestIntervals:
    def test_sync_without_key_returns_400(self, base_url, auth_headers):
        r = requests.post(f"{base_url}/api/intervals/sync", headers=auth_headers)
        assert r.status_code == 400, r.text

    def test_workouts_empty_when_not_connected(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/workouts", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["connected"] is False
        assert isinstance(d["workouts"], list)


# ---------------- Coach ----------------
class TestCoach:
    def test_chat_returns_reply(self, base_url, auth_headers):
        r = requests.post(f"{base_url}/api/coach/chat",
                          headers=auth_headers,
                          json={"message": "Estou desanimado hoje, o que faço?"},
                          timeout=90)
        assert r.status_code == 200, r.text
        reply = r.json()["reply"]
        assert isinstance(reply, str) and len(reply) > 20

    def test_history(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/coach/history", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json()["messages"], list)


# ---------------- Nutrition ----------------
def _real_food_jpeg_bytes():
    """
    Fetch a real food photo (small, JPEG). Falls back to a locally-generated
    JPEG with real visual features (gradient + shapes) using Pillow if online
    fetch fails. Never blank/uniform.
    """
    urls = [
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=70",  # bowl
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=70",  # burger
    ]
    for u in urls:
        try:
            resp = requests.get(u, timeout=15)
            if resp.status_code == 200 and resp.content[:3] == b"\xff\xd8\xff":
                return resp.content, "image/jpeg"
        except Exception:
            pass
    # Fallback: generate a JPEG with edges/shapes
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (512, 384), (30, 60, 30))
    d = ImageDraw.Draw(im)
    d.ellipse((60, 60, 260, 260), fill=(220, 200, 120))  # rice
    d.rectangle((280, 100, 460, 260), fill=(160, 40, 30))  # meat
    d.ellipse((80, 280, 200, 360), fill=(60, 140, 40))  # broccoli
    for i in range(0, 512, 8):
        d.line((i, 0, i, 384), fill=(0, 0, 0, 0), width=1)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue(), "image/jpeg"


class TestNutrition:
    _meal_id = None
    _photo_path = None

    def test_analyze_photo(self, base_url, auth_token):
        img, mime = _real_food_jpeg_bytes()
        files = {"file": ("meal.jpg", img, mime)}
        data = {"meal_type": "lunch"}
        headers = {"Authorization": f"Bearer {auth_token}"}
        r = requests.post(f"{base_url}/api/nutrition/analyze",
                          headers=headers, files=files, data=data, timeout=180)
        assert r.status_code == 200, r.text
        j = r.json()
        # Validate returned nutrition fields
        for k in ("id", "title", "calories", "protein_g", "carbs_g", "fat_g",
                  "coach_note", "photo_url", "storage_path"):
            assert k in j, f"missing {k}: {j}"
        assert isinstance(j["calories"], (int, float))
        assert j["photo_url"].startswith("/api/files/")
        TestNutrition._meal_id = j["id"]
        TestNutrition._photo_path = j["storage_path"]

    def test_list_nutrition_contains_meal(self, base_url, auth_headers):
        assert TestNutrition._meal_id, "previous test must have created a meal"
        r = requests.get(f"{base_url}/api/nutrition", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert "meals" in j and "totals" in j
        ids = [m["id"] for m in j["meals"]]
        assert TestNutrition._meal_id in ids
        assert j["totals"]["calories"] >= 0

    def test_serve_file(self, base_url):
        assert TestNutrition._photo_path
        r = requests.get(f"{base_url}/api/files/{TestNutrition._photo_path}", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("image/")
        assert len(r.content) > 500

    def test_delete_meal_soft(self, base_url, auth_headers):
        assert TestNutrition._meal_id
        r = requests.delete(f"{base_url}/api/nutrition/{TestNutrition._meal_id}", headers=auth_headers)
        assert r.status_code == 200
        # Verify removed from listing
        r2 = requests.get(f"{base_url}/api/nutrition", headers=auth_headers)
        ids = [m["id"] for m in r2.json()["meals"]]
        assert TestNutrition._meal_id not in ids
