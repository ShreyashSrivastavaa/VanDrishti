import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Compass, ArrowRight, Layers, Sliders, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { data: aois, isLoading: aoisLoading } = useQuery({
    queryKey: ['aois'],
    queryFn: api.getAois,
  });

  const totalAois = aois?.length ?? 0;
  const totalAreaKm2 = aois?.reduce((acc, a) => acc + (a.areaKm2 || 0), 0) ?? 0;
  const totalObservations = aois?.reduce((acc, a) => acc + (a.observationCount || 0), 0) ?? 0;

  return (
    <div className="flex flex-col min-h-[calc(100vh-52px)]">
      {/* Hero Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full border-b border-rule">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-surface border border-rule rounded text-[11px] font-mono text-forest-900">
              <span className="w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
              <span>Free & Public-Interest Satellite Observatory</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-forest-900 leading-[1.15]">
              Monitoring suspected forest loss from Sentinel-2 satellite imagery.
            </h1>

            <p className="text-ink-muted text-base sm:text-lg leading-relaxed max-w-2xl">
              ForestWatch AI applies multi-spectral remote sensing and machine learning to Copernicus Sentinel-2 observations. We make environmental canopy change transparent, reproducible, and accessible to researchers, civil society, and the public.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/map"
                className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-700 text-paper px-4 py-2.5 rounded font-medium text-[14px] transition-colors shadow-sm"
              >
                <Compass className="w-4 h-4" />
                <span>Open the Map</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-75" />
              </Link>

              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 bg-surface hover:bg-paper text-ink border border-rule hover:border-forest-700 px-4 py-2.5 rounded font-medium text-[14px] transition-colors"
              >
                <FileText className="w-4 h-4 text-ink-muted" />
                <span>Scientific Methodology</span>
              </Link>
            </div>
          </div>

          {/* Live Metrics Panel (Strictly from real database rows) */}
          <div className="lg:col-span-5 bg-surface border border-rule rounded p-5 sm:p-6 space-y-4">
            <div className="border-b border-rule pb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
                Active Observatory Ledger
              </span>
              <p className="text-xs text-ink-muted mt-0.5">
                Metrics dynamically loaded from active PostGIS database tables.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-paper border border-rule rounded">
                <span className="text-[11px] text-ink-muted uppercase font-mono block">Curated Regions</span>
                <span className="text-2xl sm:text-3xl font-mono font-semibold text-forest-900 tabular-nums">
                  {aoisLoading ? '…' : totalAois}
                </span>
                <span className="text-[10px] text-ink-muted block mt-0.5">High-risk biomes</span>
              </div>

              <div className="p-3 bg-paper border border-rule rounded">
                <span className="text-[11px] text-ink-muted uppercase font-mono block">Monitored Area</span>
                <span className="text-2xl sm:text-3xl font-mono font-semibold text-forest-900 tabular-nums">
                  {aoisLoading ? '…' : `${Math.round(totalAreaKm2)} km²`}
                </span>
                <span className="text-[10px] text-ink-muted block mt-0.5">Projected UTM bounds</span>
              </div>

              <div className="p-3 bg-paper border border-rule rounded">
                <span className="text-[11px] text-ink-muted uppercase font-mono block">Satellite Passes</span>
                <span className="text-2xl sm:text-3xl font-mono font-semibold text-forest-900 tabular-nums">
                  {aoisLoading ? '…' : totalObservations}
                </span>
                <span className="text-[10px] text-ink-muted block mt-0.5">Sentinel-2 MSI Level-2A</span>
              </div>

              <div className="p-3 bg-paper border border-rule rounded">
                <span className="text-[11px] text-ink-muted uppercase font-mono block">Resolution</span>
                <span className="text-2xl sm:text-3xl font-mono font-semibold text-forest-900 tabular-nums">
                  10 m
                </span>
                <span className="text-[10px] text-ink-muted block mt-0.5">Per-pixel ground sample</span>
              </div>
            </div>

            <div className="p-3 bg-olive-200/40 border border-olive-600/30 rounded text-[11px] text-ink flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
              <span>Zero paywalls, no tracking tokens, no sponsored gating. Free for public research.</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works (4 Truthful Steps) */}
      <section className="py-12 px-4 sm:px-6 max-w-6xl mx-auto w-full border-b border-rule">
        <div className="max-w-2xl mb-8">
          <span className="text-[11px] font-mono uppercase tracking-wider text-forest-700 font-semibold">
            The Analysis Pipeline
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-forest-900 mt-1">
            How suspected forest loss is detected
          </h2>
          <p className="text-ink-muted text-sm mt-2 leading-relaxed">
            Every step is mathematically transparent and reproducible, combining cloud-screened optical physics with rigorous spatial polygonisation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-surface border border-rule rounded space-y-2">
            <div className="w-7 h-7 bg-forest-900 text-paper rounded flex items-center justify-center font-mono text-xs font-semibold">
              01
            </div>
            <h3 className="font-medium text-ink text-sm">Windowed Ingestion & SCL Masking</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Windowed HTTP range requests fetch 10m bands directly from Cloud-Optimized GeoTIFFs. Clouds, cloud shadows, and defective pixels from the Scene Classification Layer (SCL) are dilated and masked.
            </p>
          </div>

          <div className="p-4 bg-surface border border-rule rounded space-y-2">
            <div className="w-7 h-7 bg-forest-900 text-paper rounded flex items-center justify-center font-mono text-xs font-semibold">
              02
            </div>
            <h3 className="font-medium text-ink text-sm">Spectral Indices & Tree Cover</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Normalized Difference Vegetation Index (NDVI), Normalized Burn Ratio (NBR), and SWIR reflectance are computed at 10m grid alignment to model canopy vigor and leaf moisture content.
            </p>
          </div>

          <div className="p-4 bg-surface border border-rule rounded space-y-2">
            <div className="w-7 h-7 bg-forest-900 text-paper rounded flex items-center justify-center font-mono text-xs font-semibold">
              03
            </div>
            <h3 className="font-medium text-ink text-sm">Bi-Temporal Hysteresis</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Candidate clearing requires high forest probability at earlier date t0 (≥ 0.70) and low forest probability at t1 (≤ 0.30), suppressing edge jitter. A minimum 0.15 NDVI drop is enforced.
            </p>
          </div>

          <div className="p-4 bg-surface border border-rule rounded space-y-2">
            <div className="w-7 h-7 bg-forest-900 text-paper rounded flex items-center justify-center font-mono text-xs font-semibold">
              04
            </div>
            <h3 className="font-medium text-ink text-sm">MMU Filtering & Polygonisation</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Connected components smaller than 0.5 hectares are eliminated to avoid salt-and-pepper noise. Surviving patches are vectorised into PostGIS polygons with audited hectare measurements.
            </p>
          </div>
        </div>
      </section>

      {/* Curated AOIs Showcase */}
      <section className="py-12 px-4 sm:px-6 max-w-6xl mx-auto w-full border-b border-rule">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-forest-700 font-semibold">
              Selected Geographies
            </span>
            <h2 className="font-serif text-2xl font-semibold text-forest-900 mt-1">
              Curated Monitoring Regions
            </h2>
          </div>
          <Link
            to="/regions"
            className="text-xs font-medium text-forest-700 hover:text-forest-900 flex items-center gap-1"
          >
            <span>View all regions and histories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {aoisLoading && (
            <div className="col-span-full py-8 text-center text-xs text-ink-muted font-mono">
              Loading active monitoring regions from database...
            </div>
          )}

          {aois?.map((aoi) => (
            <div
              key={aoi.id}
              className="bg-surface border border-rule rounded p-4 flex flex-col justify-between hover:border-forest-700 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink-muted uppercase px-1.5 py-0.5 bg-paper border border-rule rounded">
                    {aoi.countryCode}
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {aoi.areaKm2} km²
                  </span>
                </div>

                <h3 className="font-serif font-semibold text-ink text-base">
                  {aoi.name}
                </h3>

                <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                  {aoi.description}
                </p>
              </div>

              <div className="pt-4 mt-2 border-t border-rule/60 flex items-center justify-between">
                <Link
                  to={`/map?aoi=${aoi.slug}`}
                  className="text-xs font-medium text-forest-900 hover:text-forest-700 flex items-center gap-1"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Inspect in Map</span>
                </Link>
                <Link
                  to={`/regions/${aoi.slug}`}
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  Dashboard →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Observational Limitations & Honest Caveats */}
      <section className="py-12 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="p-5 sm:p-6 bg-surface border border-rule rounded space-y-3">
          <div className="flex items-center gap-2 text-warn-500 font-medium text-sm">
            <AlertTriangle className="w-4.5 h-4.5" />
            <span>Methodological Limitations & Truth in Science</span>
          </div>
          <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
            Satellite remote sensing provides objective measurements of electromagnetic surface reflectance, not ground-truth intentions. An observed loss in canopy greenness can be caused by wildfire burn scars, seasonal leaf senescence during dry seasons, rotational timber plantation harvesting, flooded riverbanks, or cloud shadow artifacts. Always consult independent reference datasets (e.g. Hansen Global Forest Change) and corroborate detections with high-resolution imagery and field inspections.
          </p>
        </div>
      </section>
    </div>
  );
};
