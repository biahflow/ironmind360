import os
import uuid
from datetime import datetime, timezone

import boto3
import requests
from bson import ObjectId
from botocore.exceptions import ClientError
from pymongo import MongoClient


def test_private_file_requires_owner(base_url):
    suffix = uuid.uuid4().hex
    password = "SecurityTest123!"

    def register(label):
        response = requests.post(
            f"{base_url}/api/v1/auth/register",
            json={
                "email": f"file-{label}-{suffix}@example.com",
                "password": password,
                "name": f"File {label}",
            },
            timeout=15,
        )
        assert response.status_code == 200, response.text
        return response.json()

    owner = register("owner")
    stranger = register("stranger")
    file_id = str(uuid.uuid4())
    storage_key = f"private/{owner['user']['id']}/{file_id}.txt"
    content = b"private-file-security-check"

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT_URL"],
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        region_name=os.environ.get("S3_REGION", "us-east-1"),
    )
    mongo = MongoClient(os.environ["MONGO_URL"])
    files = mongo[os.environ["DB_NAME"]].files
    meals = mongo[os.environ["DB_NAME"]].meals
    meal_id = ObjectId()
    try:
        s3.put_object(
            Bucket=os.environ["S3_BUCKET"],
            Key=storage_key,
            Body=content,
            ContentType="text/plain",
        )
        files.insert_one(
            {
                "_id": file_id,
                "owner_user_id": owner["user"]["id"],
                "provider": "s3",
                "storage_key": storage_key,
                "content_type": "text/plain",
                "size": len(content),
                "derivative_ids": [],
                "created_at": datetime.now(timezone.utc),
                "deleted_at": None,
            }
        )
        meals.insert_one(
            {
                "_id": meal_id,
                "user_id": owner["user"]["id"],
                "date": "2026-08-29",
                "photo_file_id": file_id,
                "title": "Private meal",
                "created_at": datetime.now(timezone.utc),
                "deleted_at": None,
            }
        )

        url = f"{base_url}/api/v1/files/{file_id}"
        assert requests.get(url, timeout=10).status_code == 401
        denied = requests.get(
            url,
            headers={"Authorization": f"Bearer {stranger['access_token']}"},
            timeout=10,
        )
        assert denied.status_code == 404
        allowed = requests.get(
            url,
            headers={"Authorization": f"Bearer {owner['access_token']}"},
            timeout=10,
        )
        assert allowed.status_code == 200
        assert allowed.content == content
        assert allowed.headers["Cache-Control"] == "private, no-store"
        assert allowed.headers["X-Content-Type-Options"] == "nosniff"

        denied_delete = requests.delete(
            f"{base_url}/api/v1/nutrition/{meal_id}",
            headers={"Authorization": f"Bearer {stranger['access_token']}"},
            timeout=10,
        )
        assert denied_delete.status_code == 404
        assert meals.find_one({"_id": meal_id})["deleted_at"] is None

        owner_delete = requests.delete(
            f"{base_url}/api/v1/nutrition/{meal_id}",
            headers={"Authorization": f"Bearer {owner['access_token']}"},
            timeout=10,
        )
        assert owner_delete.status_code == 200, owner_delete.text
        assert files.find_one({"_id": file_id})["deleted_at"] is not None
        assert meals.find_one({"_id": meal_id})["deleted_at"] is not None
        try:
            s3.head_object(Bucket=os.environ["S3_BUCKET"], Key=storage_key)
            raise AssertionError("physical object should have been deleted")
        except ClientError as error:
            assert error.response["ResponseMetadata"]["HTTPStatusCode"] == 404
    finally:
        meals.delete_one({"_id": meal_id})
        files.delete_one({"_id": file_id})
        s3.delete_object(Bucket=os.environ["S3_BUCKET"], Key=storage_key)
        mongo.close()


def test_legacy_meal_photo_migrates_and_requires_owner(base_url):
    """Refeicoes legadas (com storage_path e sem photo_file_id) devem ser servidas
    por rota autenticada: a listagem migra a foto para um registro `files` opaco e
    a leitura exige propriedade."""
    suffix = uuid.uuid4().hex
    password = "SecurityTest123!"

    def register(label):
        response = requests.post(
            f"{base_url}/api/v1/auth/register",
            json={
                "email": f"legacy-{label}-{suffix}@example.com",
                "password": password,
                "name": f"Legacy {label}",
            },
            timeout=15,
        )
        assert response.status_code == 200, response.text
        return response.json()

    owner = register("owner")
    stranger = register("stranger")
    meal_date = "2026-08-29"
    legacy_key = f"legacy/{owner['user']['id']}/{suffix}.jpg"

    mongo = MongoClient(os.environ["MONGO_URL"])
    database = mongo[os.environ["DB_NAME"]]
    meals = database.meals
    files = database.files
    meal_id = ObjectId()
    try:
        meals.insert_one(
            {
                "_id": meal_id,
                "user_id": owner["user"]["id"],
                "date": meal_date,
                "storage_path": legacy_key,
                "title": "Refeicao legada",
                "created_at": datetime.now(timezone.utc),
                "deleted_at": None,
            }
        )

        listed = requests.get(
            f"{base_url}/api/v1/nutrition",
            params={"date": meal_date},
            headers={"Authorization": f"Bearer {owner['access_token']}"},
            timeout=10,
        )
        assert listed.status_code == 200, listed.text
        target = next(
            meal for meal in listed.json()["meals"] if meal["id"] == str(meal_id)
        )
        assert target["photo_url"] and target["photo_url"].startswith("/api/v1/files/")
        file_id = target["photo_url"].rsplit("/", 1)[-1]

        # A listagem migrou a foto legada para um registro `files` opaco e ligou a refeicao a ele.
        migrated = files.find_one({"_id": file_id})
        assert migrated is not None
        assert migrated["provider"] == "legacy_proxy"
        assert migrated["storage_key"] == legacy_key
        assert migrated["owner_user_id"] == owner["user"]["id"]
        assert meals.find_one({"_id": meal_id})["photo_file_id"] == file_id

        # A rota autenticada aplica ownership antes de tocar no provider legado.
        file_url = f"{base_url}/api/v1/files/{file_id}"
        assert requests.get(file_url, timeout=10).status_code == 401
        denied = requests.get(
            file_url,
            headers={"Authorization": f"Bearer {stranger['access_token']}"},
            timeout=10,
        )
        assert denied.status_code == 404

        # Uma segunda listagem reaproveita o mesmo registro, sem duplicar.
        again = requests.get(
            f"{base_url}/api/v1/nutrition",
            params={"date": meal_date},
            headers={"Authorization": f"Bearer {owner['access_token']}"},
            timeout=10,
        )
        assert again.status_code == 200, again.text
        repeated = next(
            meal for meal in again.json()["meals"] if meal["id"] == str(meal_id)
        )
        assert repeated["photo_url"].rsplit("/", 1)[-1] == file_id
        assert (
            files.count_documents(
                {
                    "owner_user_id": owner["user"]["id"],
                    "provider": "legacy_proxy",
                    "storage_key": legacy_key,
                }
            )
            == 1
        )
    finally:
        meals.delete_one({"_id": meal_id})
        files.delete_many(
            {"owner_user_id": owner["user"]["id"], "storage_key": legacy_key}
        )
        mongo.close()
