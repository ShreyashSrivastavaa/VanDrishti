import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';
import { useQuery } from '@tanstack/react-query';
import { api, resolveArtifactUrl } from '../../lib/api';
import { AoiSummary, Observation, DensitySampleResult, TreeCoverSampleResult } from '@forestwatch/shared';
import { LayerControls } from './LayerControls';
import { MapLegend } from './MapLegend';
import { DetectionDetailPanel } from './DetectionDetailPanel';
import { AlertCircle, Trees, X, Globe } from 'lucide-react';

// Register PMTiles protocol globally once
let protocolRegistered = false;
if (typeof window !== 'undefined' && !protocolRegistered) {
  try {
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    protocolRegistered = true;
  } catch {
    // Protocol already added or running in test
  }
}

// India geographic bounding box envelope: [min_lon, min_lat, max_lon, max_lat]
const INDIA_BBOX: [number, number, number, number] = [68.0, 6.5, 97.5, 37.5];

// Fallback curated regions in case API connection is offline (labeled as demo fallback, 0 counts)
const FALLBACK_AOIS: AoiSummary[] = [
  {
    id: "385be035-df27-4152-a8bf-d7ebc7efe407",
    slug: "western-ghats-shimoga",
    name: "Western Ghats — Sharavathi Basin",
    description: "A global biodiversity hotspot in Karnataka, India.",
    countryCode: "IND",
    countryName: "India",
    biome: "Tropical Montane Wet Evergreen",
    bbox: [74.75, 14.1, 74.92, 14.25],
    areaKm2: 305.86,
    kind: "curated",
    isDemo: true,
    createdAt: "2026-10-10T00:00:00.000Z",
    latestObservationDate: null,
    observationCount: 0,
    analysisCount: 0,
    totalLossHa: 0,
  },
  {
    id: "3c9bee31-cd7e-4a96-aa66-df31619349f1",
    slug: "rondonia-jamari",
    name: "Rondônia — Jamari Forest Frontier",
    description: "Jamari national forest borderlands in northern Rondônia, Brazil.",
    countryCode: "BRA",
    countryName: "Brazil",
    biome: "Amazon Tropical Rainforest",
    bbox: [-63.25, -9.6, -63.05, -9.42],
    areaKm2: 439.24,
    kind: "curated",
    isDemo: true,
    createdAt: "2026-10-10T00:00:00.000Z",
    latestObservationDate: null,
    observationCount: 0,
    analysisCount: 0,
    totalLossHa: 0,
  },
  {
    id: "afdfbac0-3136-4a90-9336-183355a796e6",
    slug: "kalimantan-kahayan",
    name: "Central Kalimantan — Kahayan Peatlands",
    description: "Tropical peat swamp forest adjacent to the Kahayan basin.",
    countryCode: "IDN",
    countryName: "Indonesia",
    biome: "Borneo Peat Swamp Forest",
    bbox: [113.8, -2.45, 114.0, -2.3],
    areaKm2: 370.82,
    kind: "curated",
    isDemo: true,
    createdAt: "2026-10-10T00:00:00.000Z",
    latestObservationDate: null,
    observationCount: 0,
    analysisCount: 0,
    totalLossHa: 0,
  },
  {
    id: "8e60709c-803d-4e64-bae4-faf55bbd8426",
    slug: "madre-de-dios-inambari",
    name: "Madre de Dios — Inambari Alluvial Basin",
    description: "Inambari river basin in Peru with alluvial mining pressure.",
    countryCode: "PER",
    countryName: "Peru",
    biome: "Southwest Amazon Moist Forests",
    bbox: [-70.35, -12.95, -70.18, -12.8],
    areaKm2: 307.53,
    kind: "curated",
    isDemo: true,
    createdAt: "2026-10-10T00:00:00.000Z",
    latestObservationDate: null,
    observationCount: 0,
    analysisCount: 0,
    totalLossHa: 0,
  },
  {
    id: "acd82d59-c14f-479a-9166-e0adfb099e16",
    slug: "mato-grosso-sinop",
    name: "Mato Grosso — Sinop Agricultural Border",
    description: "Amazon-Cerrado ecotone with mechanized agriculture borders.",
    countryCode: "BRA",
    countryName: "Brazil",
    biome: "Amazon-Cerrado Ecotone",
    bbox: [-55.65, -11.95, -55.45, -11.75],
    areaKm2: 484.3,
    kind: "curated",
    isDemo: true,
    createdAt: "2026-10-10T00:00:00.000Z",
    latestObservationDate: null,
    observationCount: 0,
    analysisCount: 0,
    totalLossHa: 0,
  },
  {
    id: "27a9b182-a763-4656-a570-de00eae1f569",
    slug: "vasterbotten-vindeln",
    name: "Västerbotten — Vindeln Boreal Managed Forest",
    description: "Managed boreal conifer forest stand in northern Sweden.",
    countryCode: "SWE",
    countryName: "Sweden",
    biome: "Scandinavian Boreal Taiga",
    bbox: [19.55, 64.15, 19.85, 64.3],
    areaKm2: 242.08,
    kind: "curated",
    isDemo: true,
    createdAt: "2026-10-10T00:00:00.000Z",
    latestObservationDate: null,
    observationCount: 0,
    analysisCount: 0,
    totalLossHa: 0,
  },
];

// Helper to convert bbox [minLon, minLat, maxLon, maxLat] to MapLibre image coordinates:
// [[top-left], [top-right], [bottom-right], [bottom-left]]
function bboxToCoordinates(bbox: [number, number, number, number]): [[number, number], [number, number], [number, number], [number, number]] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [
    [minLon, maxLat],
    [maxLon, maxLat],
    [maxLon, minLat],
    [minLon, minLat],
  ];
}

// Generate a 16x16 diagonal hatch fill pattern for color-blind safe Suspected Forest Loss
function createHatchImage(): ImageData {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(181, 64, 43, 0.35)'; // Loss base tint
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#8A2818'; // Dark red-orange hatch stripes
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-4, 12);
  ctx.lineTo(12, -4);
  ctx.moveTo(0, 16);
  ctx.lineTo(16, 0);
  ctx.moveTo(4, 20);
  ctx.lineTo(20, 4);
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

// Find first label symbol layer in the basemap style so raster layers sit underneath
function findFirstLabelLayerId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  for (const layer of layers) {
    if (layer.type === 'symbol' && (
      layer.id.includes('label') ||
      layer.id.includes('place') ||
      layer.id.includes('road_label') ||
      layer.id.includes('poi') ||
      layer.id.includes('admin')
    )) {
      return layer.id;
    }
  }
  for (const layer of layers) {
    if (layer.type === 'symbol') {
      return layer.id;
    }
  }
  return undefined;
}

// Procedural national tree cover density canvas overlay for standalone preview
function createNationalTreeCoverDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Subtle gradient mimicking Western Ghats and Himalayan tree-cover density
  const grad = ctx.createLinearGradient(0, 128, 128, 0);
  grad.addColorStop(0.1, 'rgba(15, 58, 34, 0.75)');   // Dark green (SW Ghats)
  grad.addColorStop(0.4, 'rgba(127, 166, 90, 0.55)'); // Mid green (Central India)
  grad.addColorStop(0.7, 'rgba(221, 229, 184, 0.35)');// Light green (Dry areas)
  grad.addColorStop(0.9, 'rgba(31, 90, 50, 0.70)');   // Northeast / Foothills
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  return canvas.toDataURL();
}

export const MapWorkspace: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isMapLoadedRef = useRef(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const aoiSlugFromUrl = searchParams.get('aoi');
  const detectionIdFromUrl = searchParams.get('detection');

  // 1. Fetch AOIs
  const { data: remoteAois = [], isError: aoisError, isLoading: aoisLoading } = useQuery({
    queryKey: ['aois'],
    queryFn: api.getAois,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const aois = remoteAois.length > 0 ? remoteAois : (aoisError ? FALLBACK_AOIS : []);
  const [selectedAoi, setSelectedAoi] = useState<AoiSummary | null>(null);

  // Sync AOI from URL on load
  useEffect(() => {
    if (aois.length > 0) {
      if (aoiSlugFromUrl) {
        const found = aois.find(a => a.slug === aoiSlugFromUrl);
        if (found) {
          setSelectedAoi(found);
          return;
        }
      }
    }
  }, [aois, aoiSlugFromUrl]);

  // Observations for the selected AOI
  const { data: observations = [], isLoading: obsLoading, isError: obsError } = useQuery({
    queryKey: ['observations', selectedAoi?.slug],
    queryFn: () => selectedAoi ? api.getAoiObservations(selectedAoi.slug) : Promise.resolve([]),
    enabled: !!selectedAoi,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // Selected date pair
  const [selectedObsT0, setSelectedObsT0] = useState<Observation | null>(null);
  const [selectedObsT1, setSelectedObsT1] = useState<Observation | null>(null);

  useEffect(() => {
    const usable = observations.filter(o => o.usable);
    if (usable.length >= 2) {
      setSelectedObsT0(usable[0]);
      setSelectedObsT1(usable[usable.length - 1]);
    } else if (usable.length === 1) {
      setSelectedObsT0(usable[0]);
      setSelectedObsT1(usable[0]);
    } else if (observations.length > 0) {
      setSelectedObsT0(observations[0]);
      setSelectedObsT1(observations[0]);
    } else {
      setSelectedObsT0(null);
      setSelectedObsT1(null);
    }
  }, [observations]);

  // Active observation for map raster displays (prefer most recent t1, fallback to t0)
  const activeObs = selectedObsT1 || selectedObsT0 || (observations[0] ?? null);

  // Analyses for this AOI
  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', selectedAoi?.slug],
    queryFn: () => selectedAoi ? api.getAoiAnalyses(selectedAoi.slug) : Promise.resolve([]),
    enabled: !!selectedAoi,
  });

  const latestAnalysis = analyses[0] || null;

  // Detections GeoJSON for the latest analysis
  const { data: detectionsGeoJson } = useQuery({
    queryKey: ['detections', latestAnalysis?.id],
    queryFn: () => latestAnalysis ? api.getAnalysisDetections(latestAnalysis.id) : Promise.resolve(null),
    enabled: !!latestAnalysis,
  });

  // Selected Detection details
  const [selectedDetection, setSelectedDetection] = useState<any | null>(null);

  // Layer Toggles & Opacities (Default layers on first load per specification):
  // - National tree cover (reference): ON (75%)
  // - Tree Cover Density (AOI): ON (70%)
  // - AOI outline: ON
  // - Suspected Forest Loss: ON (90%)
  // - Sentinel-2 True Colour: OFF (85%)
  // - Forest Cover (Baseline): OFF (45%)
  const [showNationalTreeCover, setShowNationalTreeCover] = useState(true);
  const [nationalTreeCoverOpacity, setNationalTreeCoverOpacity] = useState(0.75);

  const [showDensity, setShowDensity] = useState(true);
  const [densityOpacity, setDensityOpacity] = useState(0.70);

  const [showSatellite, setShowSatellite] = useState(false);
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.85);

  const [showForestMask, setShowForestMask] = useState(false);
  const [forestMaskOpacity, setForestMaskOpacity] = useState(0.45);

  const [showLoss, setShowLoss] = useState(true);
  const [lossOpacity, setLossOpacity] = useState(0.90);

  const [showAoiBoundaries, setShowAoiBoundaries] = useState(true);

  // Sampling readout state (both AOI observation & National reference layer)
  const [sampledReadout, setSampledReadout] = useState<{
    lat: number;
    lon: number;
    percent: number | null;
    label: string;
    source: string;
    date?: string;
    isNational?: boolean;
  } | null>(null);

  const sampleTimeoutRef = useRef<any>(null);

  // Fit bounds helper respecting prefers-reduced-motion and ~48px padding
  const fitMapToAoi = useCallback((aoi: AoiSummary, immediate = false) => {
    const map = mapRef.current;
    if (!map) return;

    const [minLon, minLat, maxLon, maxLat] = aoi.bbox;
    const prefersReducedMotion = typeof window !== 'undefined' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const duration = immediate || prefersReducedMotion ? 0 : 1000;

    map.fitBounds(
      [[minLon, minLat], [maxLon, maxLat]],
      {
        padding: { top: 48, bottom: 48, left: 48, right: 48 },
        maxZoom: 13,
        duration,
      }
    );
  }, []);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const basemapStyle = import.meta.env.VITE_BASEMAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';

    // Initial center: if AOI in URL, center on AOI; else center on India
    const initialCenter: [number, number] = selectedAoi 
      ? [(selectedAoi.bbox[0] + selectedAoi.bbox[2]) / 2, (selectedAoi.bbox[1] + selectedAoi.bbox[3]) / 2]
      : [78.9629, 20.5937]; // India center

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapStyle,
      center: initialCenter,
      zoom: selectedAoi ? 10 : 4.5,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      isMapLoadedRef.current = true;

      // Register loss hatch pattern
      if (!map.hasImage('loss-hatch')) {
        map.addImage('loss-hatch', createHatchImage());
      }

      const firstLabelId = findFirstLabelLayerId(map);

      // 1. National Reference Tree-Cover Layer (sits below text labels)
      const pmtilesUrl = import.meta.env.VITE_TREECOVER_PMTILES_URL;
      if (pmtilesUrl) {
        map.addSource('national-treecover-source', {
          type: 'raster',
          url: `pmtiles://${pmtilesUrl}`,
          tileSize: 256,
        });
      } else {
        // Fallback procedural image covering India envelope
        map.addSource('national-treecover-source', {
          type: 'image',
          url: createNationalTreeCoverDataUrl(),
          coordinates: bboxToCoordinates(INDIA_BBOX),
        });
      }

      map.addLayer({
        id: 'national-treecover-layer',
        type: 'raster',
        source: 'national-treecover-source',
        layout: {
          visibility: showNationalTreeCover ? 'visible' : 'none',
        },
        paint: {
          'raster-opacity': nationalTreeCoverOpacity,
          'raster-fade-duration': 150,
        },
      }, firstLabelId);

      // 2. AOI Outline Source & Layers
      map.addSource('aois', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'aois-fill',
        type: 'fill',
        source: 'aois',
        paint: {
          'fill-color': '#1E3A2A',
          'fill-opacity': 0.04,
        },
      });

      map.addLayer({
        id: 'aois-line',
        type: 'line',
        source: 'aois',
        paint: {
          'line-color': '#1E3A2A',
          'line-width': 1.5,
          'line-dasharray': [4, 2],
        },
      });

      // Click on AOI polygon selects it
      map.on('click', 'aois-fill', (e) => {
        if (e.features && e.features[0]) {
          const slug = e.features[0].properties?.slug;
          const found = aois.find(a => a.slug === slug);
          if (found) {
            setSelectedAoi(found);
            setSelectedDetection(null);
          }
        }
      });

      map.on('mouseenter', 'aois-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'aois-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      // 3. Suspected Forest Loss Detections Source & Layers (Drawn on TOP of all rasters)
      map.addSource('detections', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'detections-fill',
        type: 'fill',
        source: 'detections',
        paint: {
          'fill-pattern': 'loss-hatch',
          'fill-opacity': lossOpacity,
        },
      });

      map.addLayer({
        id: 'detections-line',
        type: 'line',
        source: 'detections',
        paint: {
          'line-color': '#8A2818', // 2px dark red-orange stroke
          'line-width': 2,
          'line-opacity': lossOpacity,
        },
      });

      // Click on detection
      map.on('click', 'detections-fill', (e) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          setSelectedDetection({
            ...props,
            geometry: e.features[0].geometry,
            centroid: props.centroid ? JSON.parse(props.centroid) : null,
            aoiSlug: selectedAoi?.slug,
            dateT0: (latestAnalysis as any)?.dateT0,
            dateT1: (latestAnalysis as any)?.dateT1,
          });
          setSearchParams(prev => {
            prev.set('detection', props.id);
            return prev;
          });
        }
      });

      map.on('mouseenter', 'detections-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'detections-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      mapRef.current = map;

      // Initial Camera Fitting:
      if (selectedAoi) {
        fitMapToAoi(selectedAoi, true);
      } else {
        // Fit all of India
        map.fitBounds(
          [[INDIA_BBOX[0], INDIA_BBOX[1]], [INDIA_BBOX[2], INDIA_BBOX[3]]],
          { padding: 48, duration: 0 }
        );
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      isMapLoadedRef.current = false;
    };
  }, []);

  // Update AOIs GeoJSON when loaded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('aois') as maplibregl.GeoJSONSource;
    if (source && aois.length > 0) {
      const fc = {
        type: 'FeatureCollection',
        features: aois.map(a => {
          let geom = a.geojson;
          if (!geom && a.bbox) {
            const [minLon, minLat, maxLon, maxLat] = a.bbox;
            geom = {
              type: 'MultiPolygon',
              coordinates: [[
                [[minLon, minLat], [minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat]]
              ]]
            };
          }
          return {
            type: 'Feature',
            id: a.id,
            geometry: geom,
            properties: { slug: a.slug, name: a.name },
          };
        }),
      };
      source.setData(fc as any);
    }
  }, [aois]);

  // Update Detections GeoJSON when loaded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('detections') as maplibregl.GeoJSONSource;
    if (source) {
      if (detectionsGeoJson) {
        source.setData(detectionsGeoJson as any);
      } else {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [detectionsGeoJson]);

  // Fit bounds when selected AOI changes
  useEffect(() => {
    if (!selectedAoi) return;
    fitMapToAoi(selectedAoi);

    setSearchParams(prev => {
      prev.set('aoi', selectedAoi.slug);
      return prev;
    });
  }, [selectedAoi, fitMapToAoi]);

  // Helper to safely manage raster image sources and layers below vector layers
  const syncRasterOverlay = useCallback((
    sourceId: string,
    layerId: string,
    rawUrl: string | null | undefined,
    coords: [[number, number], [number, number], [number, number], [number, number]] | null,
    opacity: number,
    visible: boolean,
    beforeLayerId: string
  ) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const resolvedUrl = rawUrl ? resolveArtifactUrl(rawUrl) : null;
    const hasSource = !!map.getSource(sourceId);
    const hasLayer = !!map.getLayer(layerId);

    if (!resolvedUrl || !coords) {
      if (hasLayer) map.setLayoutProperty(layerId, 'visibility', 'none');
      return;
    }

    if (hasSource) {
      const src = map.getSource(sourceId) as maplibregl.ImageSource;
      if (src && typeof src.updateImage === 'function') {
        try {
          src.updateImage({ url: resolvedUrl, coordinates: coords });
        } catch {
          if (hasLayer) map.removeLayer(layerId);
          map.removeSource(sourceId);
          createRasterLayer(map, sourceId, layerId, resolvedUrl, coords, opacity, visible, beforeLayerId);
          return;
        }
      } else {
        if (hasLayer) map.removeLayer(layerId);
        map.removeSource(sourceId);
        createRasterLayer(map, sourceId, layerId, resolvedUrl, coords, opacity, visible, beforeLayerId);
        return;
      }
    } else {
      createRasterLayer(map, sourceId, layerId, resolvedUrl, coords, opacity, visible, beforeLayerId);
    }

    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
  }, []);

  function createRasterLayer(
    map: maplibregl.Map,
    sourceId: string,
    layerId: string,
    url: string,
    coordinates: [[number, number], [number, number], [number, number], [number, number]],
    opacity: number,
    visible: boolean,
    beforeLayerId: string
  ) {
    try {
      map.addSource(sourceId, {
        type: 'image',
        url,
        coordinates,
      });

      const before = map.getLayer(beforeLayerId) ? beforeLayerId : undefined;
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        layout: {
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 150,
        },
      }, before);
    } catch {
      // Gracefully prevent unhandled console errors
    }
  }

  // Synchronize National Reference Layer Visibility & Opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('national-treecover-layer')) {
      map.setLayoutProperty('national-treecover-layer', 'visibility', showNationalTreeCover ? 'visible' : 'none');
      map.setPaintProperty('national-treecover-layer', 'raster-opacity', nationalTreeCoverOpacity);
    }
  }, [showNationalTreeCover, nationalTreeCoverOpacity]);

  // Synchronize AOI raster overlays when active observation or toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !selectedAoi) return;

    let coords: [[number, number], [number, number], [number, number], [number, number]] | null = null;
    if (activeObs?.previewBounds) {
      try {
        const parsed = typeof activeObs.previewBounds === 'string' 
          ? JSON.parse(activeObs.previewBounds) 
          : activeObs.previewBounds;
        if (Array.isArray(parsed) && parsed.length === 4) {
          coords = parsed as any;
        }
      } catch {
        // fallback
      }
    }
    if (!coords && selectedAoi.bbox) {
      coords = bboxToCoordinates(selectedAoi.bbox);
    }

    // Layer 1 (Bottom raster): Sentinel-2 True Color
    syncRasterOverlay(
      'satellite-source',
      'satellite-layer',
      activeObs?.previewUri,
      coords,
      satelliteOpacity,
      showSatellite,
      'aois-fill'
    );

    // Layer 2: Forest Cover (Baseline binary mask)
    syncRasterOverlay(
      'forest-mask-source',
      'forest-mask-layer',
      activeObs?.forestOverlayUri,
      coords,
      forestMaskOpacity,
      showForestMask,
      'aois-fill'
    );

    // Layer 3: Tree Cover Density (~100m window continuous ramp)
    const densityUrl = activeObs?.densityOverlayUri || 
      (activeObs?.forestOverlayUri ? activeObs.forestOverlayUri.replace('forest_mask.png', 'density_overlay.png') : null);

    syncRasterOverlay(
      'density-source',
      'density-layer',
      densityUrl,
      coords,
      densityOpacity,
      showDensity,
      'aois-fill'
    );
  }, [
    activeObs,
    selectedAoi,
    showDensity,
    densityOpacity,
    showSatellite,
    satelliteOpacity,
    showForestMask,
    forestMaskOpacity,
    syncRasterOverlay,
  ]);

  // Synchronize vector layers visibility & styling
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('aois-line')) {
      map.setLayoutProperty('aois-line', 'visibility', showAoiBoundaries ? 'visible' : 'none');
    }
    if (map.getLayer('aois-fill')) {
      map.setLayoutProperty('aois-fill', 'visibility', showAoiBoundaries ? 'visible' : 'none');
    }

    if (map.getLayer('detections-fill')) {
      map.setLayoutProperty('detections-fill', 'visibility', showLoss ? 'visible' : 'none');
      map.setPaintProperty('detections-fill', 'fill-opacity', lossOpacity);
    }
    if (map.getLayer('detections-line')) {
      map.setLayoutProperty('detections-line', 'visibility', showLoss ? 'visible' : 'none');
      map.setPaintProperty('detections-line', 'line-opacity', lossOpacity);
    }
  }, [showAoiBoundaries, showLoss, lossOpacity]);

  // Interactive coordinate sampling handler (hover & click)
  const handleMapSample = useCallback(async (lngLat: { lng: number; lat: number }) => {
    const lat = lngLat.lat;
    const lon = lngLat.lng;

    // 1. If cursor is inside active AOI, sample Sentinel-2 focal density
    if (selectedAoi && activeObs) {
      const [minLon, minLat, maxLon, maxLat] = selectedAoi.bbox;
      if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
        try {
          const res = await api.sampleDensity(activeObs.id, lat, lon);
          if (res) {
            setSampledReadout({
              lat: res.lat,
              lon: res.lon,
              percent: res.density,
              label: res.isCloudOrNodata ? 'Cloud / Nodata' : `Tree cover density: ${res.density}%`,
              source: `Sentinel-2 Focal Mean (~100 m window, ${res.modelStatus || 'baseline'})`,
              date: res.acquiredAt || activeObs.acquiredAt,
              isNational: false,
            });
            return;
          }
        } catch {
          // fallback
        }
      }
    }

    // 2. Otherwise, sample National Reference Tree Cover Layer
    if (showNationalTreeCover) {
      try {
        const res = await api.sampleNationalTreeCover(lat, lon);
        if (res && res.isCovered && res.treeCoverSharePercent !== null) {
          setSampledReadout({
            lat: res.lat,
            lon: res.lon,
            percent: res.treeCoverSharePercent,
            label: `Tree cover share: ${res.treeCoverSharePercent}%`,
            source: res.source,
            date: res.year,
            isNational: true,
          });
        }
      } catch {
        // silent
      }
    }
  }, [selectedAoi, activeObs, showNationalTreeCover]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!showDensity && !showNationalTreeCover) return;
      if (sampleTimeoutRef.current) clearTimeout(sampleTimeoutRef.current);
      sampleTimeoutRef.current = setTimeout(() => {
        handleMapSample(e.lngLat);
      }, 300);
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (showDensity || showNationalTreeCover) {
        handleMapSample(e.lngLat);
      }
    };

    map.on('mousemove', onMouseMove);
    map.on('click', onClick);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('click', onClick);
      if (sampleTimeoutRef.current) clearTimeout(sampleTimeoutRef.current);
    };
  }, [showDensity, showNationalTreeCover, handleMapSample]);

  // Geocode fly-to handler
  const handleGeocodeSelect = (bbox: [number, number, number, number]) => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 48, maxZoom: 13 });
  };

  // Determine if active AOI has no forest cover data yet
  // NOTICE RULE: Must NOT appear while the national layer is visible or when no AOI is selected
  const showMissingDataNotice = !showNationalTreeCover && selectedAoi && !obsLoading && (observations.length === 0 || (!activeObs?.forestOverlayUri && !activeObs?.densityOverlayUri));

  return (
    <div className="flex-1 relative flex overflow-hidden h-[calc(100vh-52px)]">
      {/* Left Control Rail */}
      <LayerControls
        aois={aois}
        selectedAoi={selectedAoi}
        onSelectAoi={(aoi) => {
          setSelectedAoi(aoi);
          setSelectedDetection(null);
        }}
        observations={observations}
        selectedObsT0={selectedObsT0}
        selectedObsT1={selectedObsT1}
        onSelectObsT0={setSelectedObsT0}
        onSelectObsT1={setSelectedObsT1}
        showNationalTreeCover={showNationalTreeCover}
        onToggleNationalTreeCover={() => setShowNationalTreeCover(!showNationalTreeCover)}
        nationalTreeCoverOpacity={nationalTreeCoverOpacity}
        onChangeNationalTreeCoverOpacity={setNationalTreeCoverOpacity}
        showDensity={showDensity}
        onToggleDensity={() => setShowDensity(!showDensity)}
        densityOpacity={densityOpacity}
        onChangeDensityOpacity={setDensityOpacity}
        showSatellite={showSatellite}
        onToggleSatellite={() => setShowSatellite(!showSatellite)}
        satelliteOpacity={satelliteOpacity}
        onChangeSatelliteOpacity={setSatelliteOpacity}
        showForestMask={showForestMask}
        onToggleForestMask={() => setShowForestMask(!showForestMask)}
        forestMaskOpacity={forestMaskOpacity}
        onChangeForestMaskOpacity={setForestMaskOpacity}
        showLoss={showLoss}
        onToggleLoss={() => setShowLoss(!showLoss)}
        lossOpacity={lossOpacity}
        onChangeLossOpacity={setLossOpacity}
        showAoiBoundaries={showAoiBoundaries}
        onToggleAoiBoundaries={() => setShowAoiBoundaries(!showAoiBoundaries)}
        onGeocodeSelect={handleGeocodeSelect}
        onSearch={api.geocode}
      />

      {/* Center Map Canvas */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" id="maplibre-container" />

        {/* Cold-Start / API waking up notification */}
        {(aoisLoading || (obsLoading && observations.length === 0)) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 bg-forest-900/95 text-paper text-xs rounded shadow-lg border border-forest-700 animate-pulse font-sans">
            <span className="w-2 h-2 rounded-full bg-olive-200 animate-ping shrink-0" />
            <span>Connecting to observatory API (free-tier server may take 30–45s to wake up)...</span>
          </div>
        )}

        {/* Persistent DEMO banner when displaying synthetic test data */}
        {(selectedAoi?.isDemo || activeObs?.isDemo) && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 bg-amber-100/95 border border-amber-400 text-amber-950 text-xs rounded shadow-sm font-medium">
            <span className="bg-amber-600 text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              DEMO
            </span>
            <span>Illustrative / synthetic test observation. Ground validation pending.</span>
          </div>
        )}

        {/* Top-center Contextual Sampling Pill */}
        {sampledReadout && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-1.5 bg-surface/95 backdrop-blur-sm border border-forest-900/30 rounded-full shadow-md text-xs font-sans animate-in fade-in slide-in-from-top-2">
            {sampledReadout.isNational ? (
              <Globe className="w-4 h-4 text-olive-600 shrink-0" />
            ) : (
              <Trees className="w-4 h-4 text-forest-700 shrink-0" />
            )}
            <span className="font-semibold text-ink">
              {sampledReadout.label}
            </span>
            <span className="text-[11px] text-ink-muted border-l border-rule pl-2 font-mono">
              {sampledReadout.date || '2021'}
            </span>
            <button
              onClick={() => setSampledReadout(null)}
              className="text-ink-muted hover:text-ink p-0.5 rounded-full"
              title="Dismiss readout"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Notice for regions with ingestion pending (only when national layer is off) */}
        {showMissingDataNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-amber-50/95 border border-amber-300 rounded shadow-md text-xs text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>No Sentinel-2 analysis computed for this region yet. Ingestion pending.</span>
          </div>
        )}

        {/* Floating Active Layers Legend */}
        <div className="absolute bottom-6 left-4 z-10">
          <MapLegend
            showNationalTreeCover={showNationalTreeCover}
            nationalTreeCoverOpacity={nationalTreeCoverOpacity}
            showDensity={showDensity}
            densityOpacity={densityOpacity}
            showSatellite={showSatellite}
            showForestMask={showForestMask}
            showLoss={showLoss}
            showAoiBoundaries={showAoiBoundaries}
            modelName={activeObs?.modelName}
            modelStatus={activeObs?.modelStatus}
            observationDate={activeObs?.acquiredAt}
          />
        </div>
      </div>

      {/* Right Contextual Inspection Panel */}
      {selectedDetection && (
        <DetectionDetailPanel
          detection={selectedDetection}
          onClose={() => {
            setSelectedDetection(null);
            setSearchParams(prev => {
              prev.delete('detection');
              return prev;
            });
          }}
        />
      )}
    </div>
  );
};
