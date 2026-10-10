import os
import shutil
from pathlib import Path
from typing import Union
from ..config import settings

class ArtifactStore:
    def __init__(self, mode: str = "local", local_dir: str = "./data/artifacts"):
        self.mode = mode
        self.local_dir = Path(local_dir).resolve()
        self.local_dir.mkdir(parents=True, exist_ok=True)

    def write_bytes(self, relative_path: str, data: bytes) -> str:
        """Writes bytes atomically to storage and returns URI/relative path."""
        target_path = self.local_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)

        temp_path = target_path.with_suffix(target_path.suffix + ".tmp")
        with open(temp_path, "wb") as f:
            f.write(data)
        os.replace(temp_path, target_path)

        return f"/artifacts/{relative_path.replace(os.sep, '/')}"

    def write_file(self, relative_path: str, source_path: Union[str, Path]) -> str:
        """Copies an existing file atomically into the store."""
        target_path = self.local_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)

        temp_path = target_path.with_suffix(target_path.suffix + ".tmp")
        shutil.copy2(source_path, temp_path)
        os.replace(temp_path, target_path)

        return f"/artifacts/{relative_path.replace(os.sep, '/')}"

    def get_local_path(self, relative_path: str) -> Path:
        return self.local_dir / relative_path

artifact_store = ArtifactStore(
    mode=settings.artifact_store,
    local_dir=settings.artifact_local_dir
)
