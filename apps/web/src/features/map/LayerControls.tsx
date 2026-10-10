import React, { useState } from 'react';
import { AoiSummary, Observation } from '@forestwatch/shared';
import { Search, Layers, Calendar, Sliders, ChevronDown, ChevronUp, MapPin, Eye, EyeOff } from 'lucide-react';

interface LayerControlsProps {
  aois: AoiSummary[];
  selectedAoi: AoiSummary | null;
  onSelectAoi: (aoi: AoiSummary) => void;
  observations: Observation[];
  selectedObsT0: Observation | null;
  selectedObsT1: Observation | null;
  onSelectObsT0: (obs: Observation) => void;
  onSelectObsT1: (obs: Observation) => void;
  showSatellite: boolean;
  onToggleSatellite: () => void;
  satelliteOpacity: number;
  onChangeSatelliteOpacity: (val: number) => void;
  showForestMask: boolean;
  onToggleForestMask: () => void;
  forestMaskOpacity: number;
  onChangeForestMaskOpacity: (val: number) => void;
  showLoss: boolean;
  onToggleLoss: () => void;
  lossOpacity: number;
  onChangeLossOpacity: (val: number) => void;
  showAoiBoundaries: boolean;
  onToggleAoiBoundaries: () => void;
  onGeocodeSelect: (bbox: [number, number, number, number]) => void;
  onSearch: (q: string) => Promise<any[]>;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  aois,
  selectedAoi,
  onSelectAoi,
  observations,
  selectedObsT0,
  selectedObsT1,
  onSelectObsT0,
  onSelectObsT1,
  showSatellite,
  onToggleSatellite,
  satelliteOpacity,
  onChangeSatelliteOpacity,
  showForestMask,
  onToggleForestMask,
  forestMaskOpacity,
  onChangeForestMaskOpacity,
  showLoss,
  onToggleLoss,
  lossOpacity,
  onChangeLossOpacity,
  showAoiBoundaries,
  onToggleAoiBoundaries,
  onGeocodeSelect,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showOpacityControls, setShowOpacityControls] = useState(false);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await onSearch(searchQuery);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-72 sm:w-80 bg-surface border-r border-rule flex flex-col h-full z-20 text-[12px] select-none overflow-y-auto">
      {/* 1. Region Selector & Geocoding Search */}
      <div className="p-3.5 border-b border-rule space-y-3">
        <div>
          <label className="text-[10px] uppercase font-mono tracking-wider text-ink-muted block font-semibold mb-1">
            Monitoring Region (AOI)
          </label>
          <div className="relative">
            <select
              value={selectedAoi?.slug || ''}
              onChange={(e) => {
                const found = aois.find(a => a.slug === e.target.value);
                if (found) onSelectAoi(found);
              }}
              className="w-full bg-paper border border-rule rounded px-2.5 py-1.5 text-xs text-ink focus:border-forest-700 outline-none appearance-none cursor-pointer font-medium"
            >
              <option value="" disabled>Select Curated Region…</option>
              {aois.map((a) => (
                <option key={a.id} value={a.slug}>
                  {a.name} ({a.countryCode}) — {a.areaKm2} km²
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-ink-muted pointer-events-none" />
          </div>
        </div>

        {/* Place Geocoder Search */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Search place or coordinates…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-paper border border-rule rounded pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-forest-700"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-ink-muted" />
        </form>

        {searchResults.length > 0 && (
          <div className="bg-paper border border-rule rounded p-1 space-y-0.5 max-h-36 overflow-y-auto">
            {searchResults.map((res, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onGeocodeSelect(res.bbox);
                  setSearchResults([]);
                  setSearchQuery(res.label.split(',')[0]);
                }}
                className="w-full text-left px-2 py-1 hover:bg-surface rounded text-[11px] text-ink truncate flex items-center gap-1.5"
              >
                <MapPin className="w-3 h-3 text-forest-700 shrink-0" />
                <span className="truncate">{res.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Observation Date Pickers */}
      {selectedAoi && (
        <div className="p-3.5 border-b border-rule space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold">
              Sentinel-2 Observations
            </span>
            <span className="text-[10px] font-mono text-ink-muted">
              {observations.filter(o => o.usable).length} clear passes
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-ink-muted block mb-1">Baseline Pass (t0):</span>
              <select
                value={selectedObsT0?.id || ''}
                onChange={(e) => {
                  const found = observations.find(o => o.id === e.target.value);
                  if (found) onSelectObsT0(found);
                }}
                className="w-full bg-paper border border-rule rounded px-2 py-1 text-xs text-ink outline-none"
              >
                {observations.map((obs) => (
                  <option key={obs.id} value={obs.id} disabled={!obs.usable}>
                    {obs.acquiredAt} — {obs.usable ? `${(obs.validFraction * 100).toFixed(0)}% clear` : `Clouded (${obs.unusableReason || 'low quality'})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[11px] text-ink-muted block mb-1">Subsequent Pass (t1):</span>
              <select
                value={selectedObsT1?.id || ''}
                onChange={(e) => {
                  const found = observations.find(o => o.id === e.target.value);
                  if (found) onSelectObsT1(found);
                }}
                className="w-full bg-paper border border-rule rounded px-2 py-1 text-xs text-ink outline-none"
              >
                {observations.map((obs) => (
                  <option key={obs.id} value={obs.id} disabled={!obs.usable}>
                    {obs.acquiredAt} — {obs.usable ? `${(obs.validFraction * 100).toFixed(0)}% clear` : `Clouded (${obs.unusableReason || 'low quality'})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. Layer Toggles & Opacity */}
      <div className="p-3.5 border-b border-rule space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Map Layers</span>
          </span>
          <button
            onClick={() => setShowOpacityControls(!showOpacityControls)}
            className="text-[10px] text-forest-700 hover:text-forest-900 font-medium flex items-center gap-0.5"
          >
            <Sliders className="w-3 h-3" />
            <span>{showOpacityControls ? 'Hide Opacity' : 'Opacity'}</span>
          </button>
        </div>

        <div className="space-y-2">
          {/* Suspected Loss */}
          <div className="flex flex-col gap-1 p-2 bg-paper border border-rule rounded">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLoss}
                  onChange={onToggleLoss}
                  className="rounded text-forest-900 accent-forest-900"
                />
                <span className="font-medium text-ink">Suspected Forest Loss</span>
              </label>
              <div className="w-3.5 h-3 border border-loss-600 hatch-pattern rounded-[1px]" />
            </div>
            {showOpacityControls && showLoss && (
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={lossOpacity}
                  onChange={(e) => onChangeLossOpacity(parseFloat(e.target.value))}
                  className="w-full accent-forest-900 h-1 bg-rule rounded"
                />
                <span className="font-mono text-[10px] text-ink-muted w-8 text-right">
                  {Math.round(lossOpacity * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Forest Mask */}
          <div className="flex flex-col gap-1 p-2 bg-paper border border-rule rounded">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showForestMask}
                  onChange={onToggleForestMask}
                  className="rounded text-forest-900 accent-forest-900"
                />
                <span className="text-ink">Forest Cover (Baseline)</span>
              </label>
              <div className="w-3.5 h-3 bg-olive-600/50 border border-olive-600 rounded-[1px]" />
            </div>
            {showOpacityControls && showForestMask && (
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={forestMaskOpacity}
                  onChange={(e) => onChangeForestMaskOpacity(parseFloat(e.target.value))}
                  className="w-full accent-forest-900 h-1 bg-rule rounded"
                />
                <span className="font-mono text-[10px] text-ink-muted w-8 text-right">
                  {Math.round(forestMaskOpacity * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Satellite Imagery */}
          <div className="flex flex-col gap-1 p-2 bg-paper border border-rule rounded">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSatellite}
                  onChange={onToggleSatellite}
                  className="rounded text-forest-900 accent-forest-900"
                />
                <span className="text-ink">Sentinel-2 True Color</span>
              </label>
              <span className="font-mono text-[9px] text-ink-muted uppercase">RGB</span>
            </div>
            {showOpacityControls && showSatellite && (
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={satelliteOpacity}
                  onChange={(e) => onChangeSatelliteOpacity(parseFloat(e.target.value))}
                  className="w-full accent-forest-900 h-1 bg-rule rounded"
                />
                <span className="font-mono text-[10px] text-ink-muted w-8 text-right">
                  {Math.round(satelliteOpacity * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* AOI Boundaries */}
          <div className="flex items-center justify-between p-2 bg-paper border border-rule rounded">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAoiBoundaries}
                onChange={onToggleAoiBoundaries}
                className="rounded text-forest-900 accent-forest-900"
              />
              <span className="text-ink">AOI Boundary Outlines</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
