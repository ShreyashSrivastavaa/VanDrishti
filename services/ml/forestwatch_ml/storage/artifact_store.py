import os
import shutil
import mimetypes
from pathlib import Path
from typing import Union, Optional
from ..config import settings

class ArtifactStore:
    def __init__(
        self,
        mode: str = "local",
        local_dir: str = "./data/artifacts",
        bucket: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        region: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        public_base_url: Optional[str] = None,
    ):
        self.mode = mode.lower()
        self.local_dir = Path(local_dir).resolve()
        self.local_dir.mkdir(parents=True, exist_ok=True)
        self.bucket = bucket or settings.s3_bucket
        self.endpoint_url = endpoint_url or settings.s3_endpoint
        self.region = region or settings.s3_region or "auto"
        self.public_base_url = public_base_url or settings.artifact_public_base_url
        self._s3_client = None

        if self.mode == "s3":
            try:
                import boto3
                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=self.endpoint_url,
                    aws_access_key_id=access_key_id or settings.s3_access_key_id,
                    aws_secret_access_key=secret_access_key or settings.s3_secret_access_key,
                    region_name=self.region,
                )
            except Exception as e:
                print(f"[ArtifactStore] S3 initialization warning: {e}. Falling back to local storage.")
                self.mode = "local"

    def write_bytes(self, relative_path: str, data: bytes) -> str:
        """Writes bytes atomically to storage and returns accessible URI."""
        norm_key = relative_path.replace(os.sep, "/").lstrip("/")

        # Always maintain local copy for worker cache
        target_path = self.local_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = target_path.with_suffix(target_path.suffix + ".tmp")
        with open(temp_path, "wb") as f:
            f.write(data)
        os.replace(temp_path, target_path)

        if self.mode == "s3" and self._s3_client and self.bucket:
            content_type, _ = mimetypes.guess_type(norm_key)
            extra_args = {"ContentType": content_type or "application/octet-stream"}
            self._s3_client.put_object(
                Bucket=self.bucket,
                Key=norm_key,
                Body=data,
                **extra_args
            )
            if self.public_base_url:
                return f"{self.public_base_url.rstrip('/')}/{norm_key}"
            return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{norm_key}"

        if self.public_base_url:
            return f"{self.public_base_url.rstrip('/')}/artifacts/{norm_key}"
        return f"/artifacts/{norm_key}"

    def write_file(self, relative_path: str, source_path: Union[str, Path]) -> str:
        """Copies an existing file atomically into the store."""
        with open(source_path, "rb") as f:
            data = f.read()
        return self.write_bytes(relative_path, data)

    def get_local_path(self, relative_path: str) -> Path:
        return self.local_dir / relative_path

artifact_store = ArtifactStore(
    mode=settings.artifact_store,
    local_dir=settings.artifact_local_dir,
    bucket=settings.s3_bucket,
    endpoint_url=settings.s3_endpoint,
    region=settings.s3_region,
    access_key_id=settings.s3_access_key_id,
    secret_access_key=settings.s3_secret_access_key,
    public_base_url=settings.artifact_public_base_url,
)
