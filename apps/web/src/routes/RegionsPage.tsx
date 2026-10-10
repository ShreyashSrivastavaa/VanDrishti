import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Compass, ExternalLink, Calendar, MapPin } from 'lucide-react';

export const RegionsPage: React.FC = () => {
  const { data: aois, isLoading } = useQuery({
    queryKey: ['aois'],
    queryFn: api.getAois,
  });

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 w-full space-y-8">
      <div>
        <span className="text-[11px] font-mono uppercase tracking-wider text-forest-700 font-semibold">
          Geographic Coverage
        </span>
        <h1 className="font-serif text-3xl font-semibold text-forest-900 mt-1">
          Curated Monitoring Regions (AOIs)
        </h1>
        <p className="text-sm text-ink-muted mt-2 max-w-2xl leading-relaxed">
          Standardized bounding boxes (each strictly ≤ 500 km²) established across high-risk tropical deforestation frontiers and temperate/boreal managed forestry stands.
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center font-mono text-xs text-ink-muted bg-surface border border-rule rounded">
          Querying PostGIS regions...
        </div>
      ) : (
        <div className="border border-rule rounded bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-paper border-b border-rule font-mono uppercase tracking-wider text-ink-muted text-[10px]">
                  <th className="p-3">Region Name</th>
                  <th className="p-3">Country</th>
                  <th className="p-3">Biome</th>
                  <th className="p-3 text-right">Area (km²)</th>
                  <th className="p-3 text-right">Satellite Passes</th>
                  <th className="p-3">Latest Clear Pass</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule font-sans">
                {aois?.map((aoi) => (
                  <tr key={aoi.id} className="hover:bg-paper/50 transition-colors">
                    <td className="p-3 font-medium text-ink">
                      <Link to={`/regions/${aoi.slug}`} className="hover:text-forest-700 font-serif text-sm">
                        {aoi.name}
                      </Link>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-ink-muted">
                      {aoi.countryCode}
                    </td>
                    <td className="p-3 text-ink-muted">
                      {aoi.biome || '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-ink tabular-nums">
                      {aoi.areaKm2}
                    </td>
                    <td className="p-3 text-right font-mono text-ink tabular-nums">
                      {aoi.observationCount}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-ink-muted">
                      {aoi.latestObservationDate || 'Pending ingest'}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/map?aoi=${aoi.slug}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-forest-900 hover:text-forest-700 px-2 py-1 bg-paper border border-rule rounded"
                      >
                        <Compass className="w-3 h-3" />
                        <span>Map</span>
                      </Link>
                      <Link
                        to={`/regions/${aoi.slug}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-ink hover:text-forest-700 px-2 py-1 bg-paper border border-rule rounded"
                      >
                        <span>Dashboard</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
