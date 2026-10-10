from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from datetime import date
import numpy as np

class STACItemMetadata:
    def __init__(
        self,
        scene_id: str,
        datetime_str: str,
        cloud_cover: float,
        assets: Dict[str, str],
        tile_id: Optional[str] = None,
        platform: Optional[str] = None,
        processing_baseline: Optional[str] = None,
    ):
        self.scene_id = scene_id
        self.datetime_str = datetime_str
        self.cloud_cover = cloud_cover
        self.assets = assets
        self.tile_id = tile_id
        self.platform = platform
        self.processing_baseline = processing_baseline

class ImageryProvider(ABC):
    """Abstract interface for Sentinel-2 satellite imagery providers."""

    @abstractmethod
    def search_scenes(
        self,
        bbox: Tuple[float, float, float, float],
        date_from: date,
        date_to: date,
        max_cloud_cover: float = 60.0,
    ) -> List[STACItemMetadata]:
        """Searches STAC catalog for Sentinel-2 Level-2A scenes intersecting bbox."""
        pass

    @abstractmethod
    def fetch_windowed_bands(
        self,
        scene: STACItemMetadata,
        bbox: Tuple[float, float, float, float],
        target_resolution_m: int = 10,
    ) -> Dict[str, np.ndarray]:
        """
        Performs windowed read of spectral bands (B02, B03, B04, B08, B11, B12, SCL)
        clipped to the given bbox. Returns numpy arrays.
        """
        pass
