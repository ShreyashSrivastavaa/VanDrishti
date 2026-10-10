import React from 'react';
import { Info } from 'lucide-react';

interface MapLegendProps {
  showDensity?: boolean;
  densityOpacity?: number;
  showSatellite: boolean;
  showForestMask: boolean;
  showLoss: boolean;
  showAoiBoundaries: boolean;
  modelName?: string | null;
  modelStatus?: string | null;
  observationDate?: string | null;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  showDensity = false,
  showSatellite,
  showForestMask,
  showLoss,
  showAoiBoundaries,
  modelName,
  modelStatus,
  observationDate,
}) => {
  const modelText = modelName 
    ? `${modelName}${modelStatus ? `, ${modelStatus}` : ''}` 
    : 'spectral_baseline, baseline';
  const dateText = observationDate || '2023-08-18';

  return (
    <div className="bg-surface/95 backdrop-blur-sm border border-rule rounded p-3 text-[11px] space-y-2.5 shadow-md max-w-sm select-none">
      <div className="flex items-center justify-between border-b border-rule/60 pb-1.5">
        <span className="font-mono uppercase font-semibold text-ink tracking-wider text-[10px]">
          Active Layers Legend
        </span>
      </div>

      <div className="space-y-2.5">
        {/* 1. Tree Cover Density Ramp */}
        {showDensity && (
          <div className="space-y-1.5 p-2 bg-paper/60 border border-rule/70 rounded">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">Tree cover density (~100 m window)</span>
              <span className="font-mono text-[9px] text-forest-700 bg-forest-900/10 px-1.5 py-0.5 rounded">
                10m L2A
              </span>
            </div>

            {/* Continuous gradient ramp matching specified stops */}
            <div className="space-y-1">
              <div 
                className="w-full h-3 rounded-[2px] border border-rule shadow-inner"
                style={{
                  background: 'linear-gradient(to right, rgba(221,229,184,0) 0%, rgba(221,229,184,0) 10%, #DDE5B8 10%, #B5CC84 25%, #7FA65A 45%, #3F7D43 65%, #1F5A32 80%, #0F3A22 100%)',
                }}
              />
              <div className="flex justify-between font-mono text-[9px] text-ink-muted px-0.5">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <p className="text-[10px] text-ink-muted leading-tight pt-0.5">
              Share of pixels classified as forest by {modelText}. Not a tree count. Source: Sentinel-2 {dateText}.
            </p>
          </div>
        )}

        {/* 2. Suspected Forest Loss (Outline + Hatch) */}
        {showLoss && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-3.5 border-2 border-[#8A2818] hatch-pattern rounded-[1px] shrink-0" 
                title="Hatch pattern with 2px stroke"
              />
              <span className="font-medium text-ink">Suspected Forest Loss</span>
            </div>
            <div className="pl-6 text-[10px] text-ink-muted flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-loss-600" /> High
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-warn-500" /> Medium
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-stone-500" /> Low
              </span>
            </div>
          </div>
        )}

        {/* 3. Forest Cover (Baseline Reference) */}
        {showForestMask && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3.5 bg-olive-600/50 border border-olive-600 rounded-[1px] shrink-0" />
            <span className="text-ink">Forest Cover (Baseline Reference)</span>
          </div>
        )}

        {/* 4. Satellite Imagery */}
        {showSatellite && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3.5 bg-paper border border-ink-muted rounded-[1px] shrink-0 flex items-center justify-center font-mono text-[8px] text-ink-muted">
              RGB
            </div>
            <span className="text-ink">Sentinel-2 True Color (L2A BOA)</span>
          </div>
        )}

        {/* 5. AOI Boundary Outlines */}
        {showAoiBoundaries && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 border-t-2 border-dashed border-forest-900 shrink-0" />
            <span className="text-ink">Monitoring Area Bounding Box</span>
          </div>
        )}
      </div>

      <div className="pt-1.5 border-t border-rule/60 flex items-start gap-1.5 text-[10px] text-ink-muted">
        <Info className="w-3 h-3 text-forest-700 shrink-0 mt-0.5" />
        <span>Loss polygons feature 2px dark-red stroke and hatch fill for color-blind safety.</span>
      </div>
    </div>
  );
};
