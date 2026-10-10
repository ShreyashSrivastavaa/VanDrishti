import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ExternalLink, Database, ShieldCheck } from 'lucide-react';

export const DataLicencesPage: React.FC = () => {
  const { data: sources, isLoading } = useQuery({
    queryKey: ['dataset_sources'],
    queryFn: api.getDatasetSources,
  });

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 w-full space-y-8">
      <header className="space-y-2 border-b border-rule pb-6">
        <span className="text-[11px] font-mono uppercase tracking-wider text-forest-700 font-semibold">
          Open Data Transparency
        </span>
        <h1 className="font-serif text-3xl font-semibold text-forest-900">
          Data Sources, Licenses & Citations
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          ForestWatch AI operates strictly with open-access satellite data, open-source cartography, and publicly licensed baseline references.
        </p>
      </header>

      {isLoading ? (
        <div className="p-8 text-center font-mono text-xs text-ink-muted bg-surface border border-rule rounded">
          Loading verified dataset sources from database...
        </div>
      ) : (
        <div className="space-y-4">
          {sources?.map((source) => (
            <div key={source.id} className="p-5 bg-surface border border-rule rounded space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rule/60 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-forest-700 shrink-0" />
                  <h2 className="font-serif font-semibold text-base text-ink">
                    {source.name}
                  </h2>
                  {source.version && (
                    <span className="font-mono text-[10px] text-ink-muted px-1.5 py-0.5 bg-paper border border-rule rounded">
                      {source.version}
                    </span>
                  )}
                </div>

                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-forest-700 hover:text-forest-900 font-medium"
                >
                  <span>Official Provider Documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                {source.description}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] font-mono">
                <div className="p-2.5 bg-paper border border-rule rounded">
                  <span className="text-[10px] uppercase text-ink-muted block font-semibold">License Terms</span>
                  <span className="text-ink font-medium mt-0.5 block">{source.licence}</span>
                </div>

                <div className="p-2.5 bg-paper border border-rule rounded">
                  <span className="text-[10px] uppercase text-ink-muted block font-semibold">Required Attribution</span>
                  <span className="text-ink mt-0.5 block">{source.attribution}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
