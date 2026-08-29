import asyncio

import boto3

from app.config import settings


class S3StorageProvider:
    def __init__(self) -> None:
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        )

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        encryption = {}
        if settings.s3_sse_algorithm:
            encryption["ServerSideEncryption"] = settings.s3_sse_algorithm
        if settings.s3_kms_key_id:
            encryption["SSEKMSKeyId"] = settings.s3_kms_key_id
        await asyncio.to_thread(
            self.client.put_object,
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            **encryption,
        )

    async def get(self, key: str) -> tuple[bytes, str]:
        response = await asyncio.to_thread(self.client.get_object, Bucket=self.bucket, Key=key)
        content = await asyncio.to_thread(response["Body"].read)
        return content, response.get("ContentType", "application/octet-stream")

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)
