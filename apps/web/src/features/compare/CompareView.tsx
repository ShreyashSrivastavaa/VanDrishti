import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Observation, Analysis } from '@forestwatch/shared';
import { ArrowLeft, Calendar, Layers, Sliders, AlertTriangle, ShieldCheck, Play, CheckCircle2 } from 'lucide-react';

export const CompareView: React.FC = () => {
  const { aoi = '' } = useParams<{ aoi: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0-100
  const isDraggingRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapBeforeRef = useRef<HTMLDivElement>(null);
  const mapAfterRef = useRef<HTMLDivElement>(null);

  const mapInstanceBefore = useRef<maplibregl.Map | null>(null);
  const mapInstanceAfter = useRef<maplibregl.Map | null>(null);

  // Queries
  const { data: aoiData } = useQuery({
    queryKey: ['aoi', aoi],
    queryFn: () => api.getAoi(aoi),
    enabled: !!aoi,
  });

  const { data: observations = [] } = useQuery({
    queryKey: ['observations', aoi],
    queryFn: () => api.getAoiObservations(aoi),
    enabled: !!aoi,
  });

  const usableObs = observations.filter(o => o.usable);

  const [obsT0, setObsT0] = useState<Observation | null>(null);
  const [obsT1, setObsT1] = useState<Observation | null>(null);

  // Layer Toggles
  const [showForestMaskBefore, setShowForestMaskBefore] = useState(false);
  const [showForestMaskAfter, setShowForestMaskAfter] = useState(false);
  const [showChangeOverlay, setShowChangeOverlay] = useState(true);

  // Sync dates from URL params or default to earliest & latest usable
  useEffect(() => {
    if (usableObs.length >= 2) {
      const paramT0 = searchParams.get('t0');
      const paramT1 = searchParams.get('t1');

      const found0 = usableObs.find(o => o.acquiredAt === paramT0) || usableObs[0];
      const found1 = usableObs.find(o => o.acquiredAt === paramT1) || usableObs[usableObs.length - 1];

      setObsT0(found0);
      setObsT1(found1);
    } else if (usableObs.length === 1) {
      setObsT0(usableObs[0]);
      setObsT1(usableObs[0]);
    }
  }, [observations]);

  // Query existing analysis for this pair
  const { data: analyses = [], refetch: refetchAnalyses } = useQuery({
    queryKey: ['analyses', aoi],
    queryFn: () => api.getAoiAnalyses(aoi),
    enabled: !!aoi,
  });

  const matchingAnalysis = analyses.find(
    an => (an as any).obsT0Id === obsT0?.id && (an as any).obsT1Id === obsT1?.id
  ) || null;

  // Detections for matching analysis
  const { data: detectionsGeoJson } = useQuery({
    queryKey: ['detections', matchingAnalysis?.id],
    queryFn: () => matchingAnalysis ? api.getAnalysisDetections(matchingAnalysis.id) : Promise.resolve(null),
    enabled: !!matchingAnalysis,
  });

  // Seasonality check
  const isSeasonMismatch = obsT0 && obsT1 && (() => {
    const d0 = new Date(obsT0.acquiredAt);
    const d1 = new Date(obsT1.acquiredAt);
    const doy0 = Math.floor((d0.getTime() - new Date(d0.getFullYear(), 0, 0).getTime()) / 86400000);
    const doy1 = Math.floor((d1.getTime() - new Date(d1.getFullYear(), 0, 0).getTime()) / 86400000);
    let diff = Math.abs(doy0 - doy1);
    if (diff > 182) diff = 365 - diff;
    return diff > 45 && d0.getFullYear() !== d1.getFullYear();
  })();

  // Initialize both MapLibre maps
  useEffect(() => {
    if (!mapBeforeRef.current || !mapAfterRef.current || mapInstanceBefore.current || !aoiData) return;

    const basemapStyle = import.meta.env.VITE_BASEMAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
    const [minLon, minLat, maxLon, maxLat] = aoiData.bbox;
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const mapB = new maplibregl.Map({
      container: mapBeforeRef.current,
      style: basemapStyle,
      center: [centerLon, centerLat],
      zoom: 11,
    });

    const mapA = new maplibregl.Map({
      container: mapAfterRef.current,
      style: basemapStyle,
      center: [centerLon, centerLat],
      zoom: 11,
    });

    // Synchronize movement between both maps
    let isSyncing = false;
    const syncMaps = (source: maplibregl.Map, target: maplibregl.Map) => {
      source.on('move', () => {
        if (isSyncing) return;
        isSyncing = true;
        target.jumpTo({
          center: source.getCenter(),
          zoom: source.getZoom(),
          bearing: source.getBearing(),
          pitch: source.getPitch(),
        });
        isSyncing = false;
      });
    };

    syncMaps(mapB, mapA);
    syncMaps(mapA, mapB);

    mapInstanceBefore.current = mapB;
    mapInstanceAfter.current = mapA;

    return () => {
      mapB.remove();
      mapA.remove();
      mapInstanceBefore.current = null;
      mapInstanceAfter.current = null;
    };
  }, [aoiData]);

  // Handle pointer swipe drag
  const handlePointerDown = () => {
    isDraggingRef.current = true;
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setSliderPos(p => Math.max(0, p - 5));
    } else if (e.key === 'ArrowRight') {
      setSliderPos(p => Math.min(100, p + 5));
    }
  };

  const handleRunAnalysis = async () => {
    if (!obsT0 || !obsT1) return;
    try {
      await api.requestAnalysis(aoi, { t0: obsT0.id, t1: obsT1.id });
      refetchAnalyses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="flex-1 flex flex-col h-[calc(100vh-52px)] relative select-none overflow-hidden"
    >
      {/* Top Controls Bar */}
      <div className="h-13 bg-surface border-b border-rule px-4 flex items-center justify-between text-xs z-30">
        <div className="flex items-center gap-3">
          <Link to={`/map?aoi=${aoi}`} className="flex items-center gap-1 text-ink-muted hover:text-ink font-medium">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Map</span>
          </Link>
          <span className="text-rule">|</span>
          <span className="font-serif font-semibold text-sm text-forest-900">
            {aoiData?.name || aoi}
          </span>
          <span className="font-mono text-[11px] text-ink-muted">
            Bi-Temporal Swipe Compare
          </span>
        </div>

        {/* Layer Toggles & Status */}
        <div className="flex items-center gap-3">
          {isSeasonMismatch && (
            <div className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-paper border border-warn-500 rounded text-[11px] text-warn-500">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Seasonality Warning (&gt;45 days DOY mismatch)</span>
            </div>
          )}

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
            <input
              type="checkbox"
              checked={showChangeOverlay}
              onChange={() => setShowChangeOverlay(!showChangeOverlay)}
              className="rounded accent-forest-900"
            />
            <span className="font-medium text-ink">Loss Overlay</span>
          </label>
        </div>
      </div>

      {/* Date Selectors Header (Attached to each side of the swipe) */}
      <div className="absolute top-13 left-0 right-0 z-20 flex justify-between px-4 py-2 pointer-events-none">
        {/* Left Side: Earlier Date (t0) */}
        <div className="bg-surface/95 border border-rule rounded p-2 text-xs pointer-events-auto shadow-sm space-y-1 max-w-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase font-semibold text-forest-900">Earlier Observation (t0)</span>
            <span className="font-mono text-[10px] text-ink-muted">Left</span>
          </div>
          <select
            value={obsT0?.id || ''}
            onChange={(e) => {
              const found = usableObs.find(o => o.id === e.target.value);
              if (found) {
                setObsT0(found);
                setSearchParams({ t0: found.acquiredAt, t1: obsT1?.acquiredAt || '' });
              }
            }}
            className="w-full bg-paper border border-rule rounded px-2 py-1 text-xs text-ink outline-none"
          >
            {observations.map(o => (
              <option key={o.id} value={o.id} disabled={!o.usable}>
                {o.acquiredAt} ({o.usable ? `${(o.validFraction*100).toFixed(0)}% clear` : 'Clouded'})
              </option>
            ))}
          </select>
          {obsT0 && (
            <div className="text-[10px] font-mono text-ink-muted pt-0.5">
              Scene: {obsT0.sceneIds[0] || 'Sentinel-2 L2A'}
            </div>
          )}
        </div>

        {/* Right Side: Later Date (t1) */}
        <div className="bg-surface/95 border border-rule rounded p-2 text-xs pointer-events-auto shadow-sm space-y-1 max-w-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase font-semibold text-forest-900">Later Observation (t1)</span>
            <span className="font-mono text-[10px] text-ink-muted">Right</span>
          </div>
          <select
            value={obsT1?.id || ''}
            onChange={(e) => {
              const found = usableObs.find(o => o.id === e.target.value);
              if (found) {
                setObsT1(found);
                setSearchParams({ t0: obsT0?.acquiredAt || '', t1: found.acquiredAt });
              }
            }}
            className="w-full bg-paper border border-rule rounded px-2 py-1 text-xs text-ink outline-none"
          >
            {observations.map(o => (
              <option key={o.id} value={o.id} disabled={!o.usable}>
                {o.acquiredAt} ({o.usable ? `${(o.validFraction*100).toFixed(0)}% clear` : 'Clouded'})
              </option>
            ))}
          </select>
          {obsT1 && (
            <div className="text-[10px] font-mono text-ink-muted pt-0.5">
              Scene: {obsT1.sceneIds[0] || 'Sentinel-2 L2A'}
            </div>
          )}
        </div>
      </div>

      {/* Main Dual-Map Swipe Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Right / Base Map (t1 later) */}
        <div ref={mapAfterRef} className="absolute inset-0 w-full h-full" />

        {/* Left Map (t0 earlier) clipped to slider position */}
        <div
          ref={mapBeforeRef}
          style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
          className="absolute inset-0 w-full h-full"
        />

        {/* Draggable Swipe Divider Bar */}
        <div
          style={{ left: `${sliderPos}%` }}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="slider"
          aria-label="Bi-temporal image comparison slider"
          aria-valuenow={Math.round(sliderPos)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="absolute top-0 bottom-0 w-1 bg-forest-900 cursor-ew-resize z-20 flex items-center justify-center -ml-0.5 focus:outline-none focus:ring-2 focus:ring-forest-700"
        >
          <div className="w-7 h-7 bg-forest-900 text-paper rounded-full border-2 border-paper flex items-center justify-center shadow-md">
            <Sliders className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Bottom Analysis Banner / Queue Trigger */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          {matchingAnalysis ? (
            <div className="p-2.5 px-4 bg-surface/95 border border-rule rounded shadow-md text-xs flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-forest-700" />
              <span>
                Change Analysis Ready: <strong className="text-loss-600 font-mono">{matchingAnalysis.totalLossHa} ha</strong> suspected loss ({matchingAnalysis.detectionCount} detections).
              </span>
              <Link
                to={`/reports/${matchingAnalysis.id}`}
                className="font-medium text-forest-900 hover:text-forest-700 underline"
              >
                View Audit Report →
              </Link>
            </div>
          ) : (
            <div className="p-2.5 px-4 bg-surface/95 border border-rule rounded shadow-md text-xs flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-warn-500" />
              <span>Analysis not yet computed for this observation date pair.</span>
              <button
                onClick={handleRunAnalysis}
                className="px-2.5 py-1 bg-forest-900 text-paper rounded hover:bg-forest-700 font-medium flex items-center gap-1 transition-colors"
              >
                <Play className="w-3 h-3" />
                <span>Compute Change</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
