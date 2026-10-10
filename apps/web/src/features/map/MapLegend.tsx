import React from 'react';
import { Info } from 'lucide-react';

interface MapLegendProps {
  showSatellite: boolean;
  showForestMask: boolean;
  showLoss: boolean;
  showAoiBoundaries: boolean;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  showSatellite,
  showForestMask,
  showLoss,
  showAoiBoundaries,
}) => {
  return (
    <div className="bg-surface/95 backdrop-blur-none border border-rule rounded p-3 text-[11px] space-y-2 shadow-sm max-w-xs">
      <div className="flex items-center justify-between border-b border-rule/60 pb-1.5">
        <span className="font-mono uppercase font-semibold text-ink tracking-wider text-[10px]">
          Active Layers Legend
        </span>
      </div>

      <div className="space-y-1.5">
        {showLoss && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3.5 border-2 border-loss-600 hatch-pattern rounded-[1px] shrink-0" />
              <span className="font-medium text-ink">Suspected Forest Loss</span>
            </div>
            <div className="pl-6 text-[10px] text-ink-muted flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-loss-600" /> High conf.
              <span className="inline-block w-2 h-2 rounded-full bg-warn-500" /> Medium
              <span className="inline-block w-2 h-2 rounded-full bg-stone-500" /> Low
            </div>
          </div>
        )}

        {showForestMask && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3.5 bg-olive-600/50 border border-olive-600 rounded-[1px] shrink-0" />
            <span className="text-ink">Forest Cover (Baseline Reference)</span>
          </div>
        )}

        {showSatellite && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3.5 bg-paper border border-ink-muted rounded-[1px] shrink-0 flex items-center justify-center font-mono text-[8px] text-ink-muted">
              RGB
            </div>
            <span className="text-ink">Sentinel-2 True Color (L2A BOA)</span>
          </div>
        )}

        {showAoiBoundaries && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 border-t-2 border-dashed border-forest-900 shrink-0" />
            <span className="text-ink">Monitoring Area Bounding Box</span>
          </div>
        )}
      </div>

      <div className="pt-1.5 border-t border-rule/60 flex items-start gap-1 text-[10px] text-ink-muted">
        <Info className="w-3 h-3 text-warn-500 shrink-0 mt-0.5" />
        <span>Loss polygons feature 2px dark-red stroke and hatch fill for color-blind safety.</span>
      </div>
    </div>
  );
};
