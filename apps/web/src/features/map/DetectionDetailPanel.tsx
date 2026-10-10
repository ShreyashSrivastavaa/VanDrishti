import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Copy, Check, ExternalLink, Download, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DetectionDetailProps {
  detection: any;
  onClose: () => void;
}

export const DetectionDetailPanel: React.FC<DetectionDetailProps> = ({ detection, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!detection) return null;

  const lat = detection.centroid ? detection.centroid[1].toFixed(5) : '—';
  const lon = detection.centroid ? detection.centroid[0].toFixed(5) : '—';
  const areaHa = typeof detection.areaHa === 'number' ? detection.areaHa.toFixed(2) : detection.areaHa;
  const confidenceScore = typeof detection.confidenceScore === 'number' 
    ? (detection.confidenceScore * 100).toFixed(0) + '%' 
    : '—';

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('detection', detection.id);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadGeoJson = () => {
    const singleGeoJson = {
      type: 'Feature',
      id: detection.id,
      geometry: detection.geometry || detection.geom,
      properties: {
        id: detection.id,
        areaHa: detection.areaHa,
        meanPLoss: detection.meanPLoss,
        meanNdviDrop: detection.meanNdviDrop,
        confidenceClass: detection.confidenceClass,
        confidenceScore: detection.confidenceScore,
        dateT0: detection.dateT0,
        dateT1: detection.dateT1,
        explanation: detection.explanation,
        attribution: 'ForestWatch AI — Contains modified Copernicus Sentinel data [2020-2024]',
      },
    };

    const blob = new Blob([JSON.stringify(singleGeoJson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detection-${detection.id}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-80 sm:w-96 bg-surface border-l border-rule flex flex-col h-full shadow-lg z-20 text-[12px] overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-rule flex items-center justify-between sticky top-0 bg-surface z-10">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-loss-600 hatch-pattern rounded-[1px]" />
          <span className="font-serif font-semibold text-sm text-forest-900">
            Suspected Forest Loss
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-paper rounded text-ink-muted hover:text-ink transition-colors"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Primary Metadata Box */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-paper border border-rule rounded">
          <div>
            <span className="text-[10px] uppercase font-mono text-ink-muted block">Area Extent</span>
            <span className="font-mono text-base font-semibold text-loss-600 tabular-nums">
              {areaHa} ha
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-ink-muted block">Confidence Score</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                detection.confidenceClass === 'high' ? 'bg-loss-600' :
                detection.confidenceClass === 'medium' ? 'bg-warn-500' : 'bg-stone-500'
              }`} />
              <span className="font-mono text-sm font-medium text-ink capitalize">
                {detection.confidenceClass || 'Medium'} ({confidenceScore})
              </span>
            </div>
          </div>

          <div className="col-span-2 pt-2 border-t border-rule/60 flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-ink-muted">Coordinates</span>
            <span className="font-mono text-[11px] text-ink tabular-nums">
              {lat}, {lon}
            </span>
          </div>
        </div>

        {/* Observation Interval */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-semibold">
            Satellite Pass Interval
          </span>
          <div className="p-2.5 bg-paper border border-rule rounded space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-ink-muted">Earlier (t0):</span>
              <span className="text-ink font-medium">{detection.dateT0 || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Later (t1):</span>
              <span className="text-ink font-medium">{detection.dateT1 || '—'}</span>
            </div>
            {detection.meanNdviDrop && (
              <div className="flex justify-between pt-1 border-t border-rule/40">
                <span className="text-ink-muted">Mean ΔNDVI:</span>
                <span className="text-loss-600 font-semibold">{Number(detection.meanNdviDrop).toFixed(3)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Model Transparency & Status */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-semibold">
            Model Provenance
          </span>
          <div className="p-2.5 bg-paper border border-rule rounded space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">Model Registry:</span>
              <span className="font-mono text-[11px] font-semibold text-forest-900 px-1.5 py-0.5 bg-olive-200/50 rounded border border-rule">
                {detection.modelStatus ? detection.modelStatus.toUpperCase() : 'BASELINE'}
              </span>
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
              {detection.isCalibratedConfidence 
                ? 'Confidence is mathematically calibrated against geographic hold-out test validation.'
                : 'Score represents uncalibrated model heuristic derived from spectral index distance and area.'}
            </p>
          </div>
        </div>

        {/* Templated Explanation */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-semibold">
            Automated Diagnosis
          </span>
          <p className="p-3 bg-surface border border-rule rounded text-xs text-ink leading-relaxed">
            {detection.explanation || 
              `Between ${detection.dateT0} and ${detection.dateT1}, an area of approximately ${areaHa} ha exhibited a sharp decline from high canopy reflectance (NDVI ≥ 0.70) to bare ground or low-biomass cover.`}
          </p>
        </div>

        {/* Known False-Positive Caveats */}
        <div className="p-3 bg-paper border border-rule rounded space-y-1.5">
          <div className="flex items-center gap-1.5 text-warn-500 font-medium text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Known Confounds & Potential False Positives</span>
          </div>
          <ul className="text-[11px] text-ink-muted space-y-1 list-disc pl-4 leading-relaxed">
            <li>Seasonal deciduous leaf-off during dry season.</li>
            <li>Rotational timber harvesting or tree-crop replanting.</li>
            <li>Wildfire burn scars and rapid surface scorch.</li>
            <li>Cloud shadow edge artifacts undetected by SCL.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-rule">
          {detection.aoiSlug && (
            <Link
              to={`/compare/${detection.aoiSlug}?t0=${detection.dateT0}&t1=${detection.dateT1}`}
              className="w-full py-2 px-3 bg-forest-900 hover:bg-forest-700 text-paper rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Bi-Temporal Swipe Compare</span>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="py-1.5 px-2 bg-surface hover:bg-paper border border-rule hover:border-forest-700 rounded text-xs text-ink flex items-center justify-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-forest-700" /> : <Copy className="w-3.5 h-3.5 text-ink-muted" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleDownloadGeoJson}
              className="py-1.5 px-2 bg-surface hover:bg-paper border border-rule hover:border-forest-700 rounded text-xs text-ink flex items-center justify-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-ink-muted" />
              <span>GeoJSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
