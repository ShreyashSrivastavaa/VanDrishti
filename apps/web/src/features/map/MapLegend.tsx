import React from 'react';
import { Info } from 'lucide-react';

interface MapLegendProps {
  showNationalTreeCover?: boolean;
  nationalTreeCoverOpacity?: number;
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
  showNationalTreeCover = false,
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
        {/* 1. National Reference Tree Cover Ramp */}
        {showNationalTreeCover && (
          <div className="space-y-1.5 p-2 bg-paper/60 border border-rule/70 rounded">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">National tree cover (reference, ~30 m)</span>
              <span className="font-mono text-[9px] text-forest-700 bg-olive-200/60 px-1.5 py-0.5 rounded font-semibold">
                Reference product
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
              Share of pixels classified as tree cover by ESA WorldCover 2021. Not a tree count and not a measure of natural forest. Source: 2021.
            </p>
          </div>
        )}

        {/* 2. AOI Tree Cover Density Ramp */}
        {showDensity && !showNationalTreeCover && (
          <div className="space-y-1.5 p-2 bg-paper/60 border border-rule/70 rounded">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">Tree cover density (~100 m window)</span>
              <span className="font-mono text-[9px] text-forest-700 bg-forest-900/10 px-1.5 py-0.5 rounded">
                {modelStatus || 'baseline'}
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

        {/* 3. Suspected Forest Loss (Outline + Hatch) */}
        {showLoss && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-3.5 border-2 border-[#8A2818] hatch-pattern rounded-[1px] shrink-0" 
                title="Hatch pattern with 2px dark red-orange stroke"
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

        {/* 4. Forest Cover (Baseline Reference) */}
        {showForestMask && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3.5 bg-olive-600/50 border border-olive-600 rounded-[1px] shrink-0" />
            <span className="text-ink">Forest Cover Mask (Binary)</span>
          </div>
        )}

        {/* 5. Sentinel-2 True Color */}
        {showSatellite && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3.5 bg-ink/20 border border-ink/40 rounded-[1px] shrink-0 flex items-center justify-center font-mono text-[8px] text-ink">
              RGB
            </div>
            <span className="text-ink">Sentinel-2 True Color (L2A)</span>
          </div>
        )}

        {/* 6. AOI Boundaries */}
        {showAoiBoundaries && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 border-t border-dashed border-forest-900 shrink-0" />
            <span className="text-ink">Curated Region Boundaries</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-rule/60 text-[9px] text-ink-muted leading-tight">
        Vegetation change is not proof of deforestation. Detections require independent verification.
      </div>
    </div>
  );
};
