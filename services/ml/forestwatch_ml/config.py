from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional

class MLSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgres://postgres:postgres@localhost:5432/forestwatch"
    database_ssl: bool = False
    imagery_provider: str = "earth-search"
    earth_search_url: str = "https://earth-search.aws.element84.com/v1"
    cdse_client_id: Optional[str] = None
    cdse_client_secret: Optional[str] = None
    max_scene_cloud_cover: int = 60
    min_valid_fraction: float = 0.70

    artifact_store: str = "local"
    artifact_local_dir: str = "./data/artifacts"
    s3_endpoint: Optional[str] = None
    s3_region: Optional[str] = None
    s3_bucket: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    artifact_public_base_url: Optional[str] = None

    worker_concurrency: int = 1
    model_device: str = "cpu"
    active_model_name: str = "spectral_baseline"
    active_model_version: str = "1.0.0"

settings = MLSettings()
