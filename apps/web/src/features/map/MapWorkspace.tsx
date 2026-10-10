import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AoiSummary, Observation } from '@forestwatch/shared';
import { LayerControls } from './LayerControls';
import { MapLegend } from './MapLegend';
import { DetectionDetailPanel } from './DetectionDetailPanel';

export const MapWorkspace: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const aoiSlugFromUrl = searchParams.get('aoi');
  const detectionIdFromUrl = searchParams.get('detection');

  // Queries
  const { data: aois = [] } = useQuery({
    queryKey: ['aois'],
    queryFn: api.getAois,
  });

  const [selectedAoi, setSelectedAoi] = useState<AoiSummary | null>(null);

  // Sync AOI from URL or default to first
  useEffect(() => {
    if (aois.length > 0) {
      if (aoiSlugFromUrl) {
        const found = aois.find(a => a.slug === aoiSlugFromUrl);
        if (found) setSelectedAoi(found);
      } else if (!selectedAoi) {
        setSelectedAoi(aois[0]);
      }
    }
  }, [aois, aoiSlugFromUrl]);

  // Observations for the selected AOI
  const { data: observations = [] } = useQuery({
    queryKey: ['observations', selectedAoi?.slug],
    queryFn: () => selectedAoi ? api.getAoiObservations(selectedAoi.slug) : Promise.resolve([]),
    enabled: !!selectedAoi,
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
    }
  }, [observations]);

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

  // Layer Toggles & Opacity
  const [showSatellite, setShowSatellite] = useState(true);
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.85);

  const [showForestMask, setShowForestMask] = useState(false);
  const [forestMaskOpacity, setForestMaskOpacity] = useState(0.45);

  const [showLoss, setShowLoss] = useState(true);
  const [lossOpacity, setLossOpacity] = useState(0.9);

  const [showAoiBoundaries, setShowAoiBoundaries] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const basemapStyle = import.meta.env.VITE_BASEMAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapStyle,
      center: [-63.15, -9.51], // Initial center (Rondonia)
      zoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      // 1. Add AOI Polygons Source
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

      // 2. Add Detections Source
      map.addSource('detections', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'detections-fill',
        type: 'fill',
        source: 'detections',
        paint: {
          'fill-color': '#B5402B',
          'fill-opacity': lossOpacity * 0.4,
        },
      });

      map.addLayer({
        id: 'detections-line',
        type: 'line',
        source: 'detections',
        paint: {
          'line-color': '#8A2818',
          'line-width': 2,
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
    });

    return () => {
      map.remove();
      mapRef.current = null;
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
        features: aois.map(a => ({
          type: 'Feature',
          id: a.id,
          geometry: a.geojson,
          properties: { slug: a.slug, name: a.name },
        })),
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

  // Fly to selected AOI bounding box
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedAoi) return;

    const [minLon, minLat, maxLon, maxLat] = selectedAoi.bbox;
    map.fitBounds(
      [[minLon, minLat], [maxLon, maxLat]],
      { padding: 60, maxZoom: 14, duration: 1200 }
    );

    setSearchParams(prev => {
      prev.set('aoi', selectedAoi.slug);
      return prev;
    });
  }, [selectedAoi]);

  // Layer visibility toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('detections-fill')) {
      map.setLayoutProperty('detections-fill', 'visibility', showLoss ? 'visible' : 'none');
      map.setPaintProperty('detections-fill', 'fill-opacity', lossOpacity * 0.4);
    }
    if (map.getLayer('detections-line')) {
      map.setLayoutProperty('detections-line', 'visibility', showLoss ? 'visible' : 'none');
      map.setPaintProperty('detections-line', 'line-opacity', lossOpacity);
    }
    if (map.getLayer('aois-line')) {
      map.setLayoutProperty('aois-line', 'visibility', showAoiBoundaries ? 'visible' : 'none');
      map.setLayoutProperty('aois-fill', 'visibility', showAoiBoundaries ? 'visible' : 'none');
    }
  }, [showLoss, lossOpacity, showAoiBoundaries]);

  // Geocode fly-to handler
  const handleGeocodeSelect = (bbox: [number, number, number, number]) => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40 });
  };

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
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Active Layers Legend */}
        <div className="absolute bottom-6 left-4 z-10">
          <MapLegend
            showSatellite={showSatellite}
            showForestMask={showForestMask}
            showLoss={showLoss}
            showAoiBoundaries={showAoiBoundaries}
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
