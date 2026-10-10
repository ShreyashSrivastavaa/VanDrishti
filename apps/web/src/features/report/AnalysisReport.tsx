import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, Download, ArrowLeft, ShieldCheck } from 'lucide-react';

export const AnalysisReport: React.FC = () => {
  const { analysisId = '' } = useParams<{ analysisId: string }>();

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', analysisId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/analyses/${analysisId}/report`);
      if (!res.ok) throw new Error('Report not found');
      return res.json();
    },
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="p-8 font-mono text-xs">Generating analysis report audit data...</div>;
  }

  if (!report) {
    return <div className="p-8 text-xs text-loss-600 font-mono">Report not found for analysis ID: {analysisId}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 text-ink print:p-0 print:max-w-none">
      {/* Print / Download Bar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-rule print:hidden">
        <Link to={`/map?aoi=${report.aoiSlug}`} className="text-xs text-ink-muted hover:text-ink flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Map</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-forest-900 text-paper rounded text-xs font-medium hover:bg-forest-700 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </button>
          <a
            href={`/api/v1/analyses/${analysisId}/export.geojson`}
            className="px-3 py-1.5 bg-surface border border-rule hover:border-forest-700 rounded text-xs font-medium text-ink flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" />
            <span>Download GeoJSON</span>
          </a>
        </div>
      </div>

      {/* Report Document Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b-2 border-forest-900 pb-3">
          <div>
            <h1 className="font-serif font-bold text-2xl text-forest-900">
              VanDrishti — Canopy Change Audit Report
            </h1>
            <p className="text-xs text-ink-muted font-mono mt-0.5">
              Public-Interest Environmental Observatory • Generated: {new Date(report.reportGeneratedAt).toUTCString()}
            </p>
          </div>
          <div className="text-right font-mono text-[11px] text-ink-muted">
            <div>Analysis ID: {report.id.substring(0, 8)}</div>
            <div>Platform: v{report.platformVersion}</div>
          </div>
        </div>

        {/* Region & Observation Metadata Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-surface border border-rule rounded text-xs font-mono">
          <div>
            <span className="text-ink-muted uppercase text-[10px] block">Region (AOI)</span>
            <span className="font-semibold text-ink">{report.aoiName}</span>
          </div>
          <div>
            <span className="text-ink-muted uppercase text-[10px] block">Country / Biome</span>
            <span className="text-ink">{report.countryCode} • {report.biome || 'Tropical'}</span>
          </div>
          <div>
            <span className="text-ink-muted uppercase text-[10px] block">Earlier Pass (t0)</span>
            <span className="text-ink">{report.dateT0} ({(report.validFractionT0 * 100).toFixed(0)}% clear)</span>
          </div>
          <div>
            <span className="text-ink-muted uppercase text-[10px] block">Later Pass (t1)</span>
            <span className="text-ink">{report.dateT1} ({(report.validFractionT1 * 100).toFixed(0)}% clear)</span>
          </div>
        </div>

        {/* Summary Findings */}
        <div className="p-4 bg-paper border border-rule rounded space-y-2">
          <h2 className="font-serif font-semibold text-base text-forest-900">
            Summary Analysis Findings
          </h2>
          <div className="grid grid-cols-3 gap-4 pt-1 font-mono">
            <div>
              <span className="text-[10px] uppercase text-ink-muted block">Total Suspected Loss</span>
              <span className="text-2xl font-bold text-loss-600 tabular-nums">
                {report.totalLossHa} ha
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-ink-muted block">Discrete Polygons</span>
              <span className="text-2xl font-bold text-ink tabular-nums">
                {report.detectionCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-ink-muted block">Model Status</span>
              <span className="text-base font-semibold text-forest-900 uppercase block mt-1">
                {report.modelStatus} ({report.modelName})
              </span>
            </div>
          </div>
        </div>

        {/* Top Detections Table */}
        {report.topDetections && report.topDetections.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="font-serif font-semibold text-sm text-ink">
              Top Detected Change Polygons (≥ 0.50 ha)
            </h3>
            <div className="border border-rule rounded overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface border-b border-rule text-[10px] text-ink-muted uppercase">
                  <tr>
                    <th className="p-2">ID</th>
                    <th className="p-2">Coordinates</th>
                    <th className="p-2 text-right">Area (ha)</th>
                    <th className="p-2">Confidence</th>
                    <th className="p-2 text-right">Mean ΔNDVI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/50">
                  {report.topDetections.map((d: any) => (
                    <tr key={d.id}>
                      <td className="p-2 text-ink-muted">{d.id.substring(0, 8)}…</td>
                      <td className="p-2">{d.lat?.toFixed(4)}, {d.lon?.toFixed(4)}</td>
                      <td className="p-2 text-right font-semibold text-loss-600">{Number(d.areaHa).toFixed(2)}</td>
                      <td className="p-2 capitalize">{d.confidenceClass} ({(d.confidenceScore * 100).toFixed(0)}%)</td>
                      <td className="p-2 text-right text-ink-muted">{d.meanNdviDrop ? Number(d.meanNdviDrop).toFixed(3) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mandatory Legal & Scientific Limitations */}
        <div className="pt-6 border-t border-rule space-y-2 text-[11px] text-ink-muted leading-relaxed">
          <p className="font-semibold text-ink">
            Methodological Notice & Legal Non-Affirmation
          </p>
          <p>
            Detections generated by VanDrishti indicate spectral shifts between Copernicus Sentinel-2 Level-2A surface reflectance passes. They represent suspected forest canopy loss and require independent ground-truthing. Canopy loss may stem from legal forestry harvesting, wildfire scars, or seasonal phenology.
          </p>
          <div className="pt-2 text-[10px] font-mono flex items-center justify-between border-t border-rule/60">
            <span>Contains modified Copernicus Sentinel data [2020-2024]</span>
            <span>Open Access under Creative Commons Attribution 4.0 International (CC BY 4.0)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
