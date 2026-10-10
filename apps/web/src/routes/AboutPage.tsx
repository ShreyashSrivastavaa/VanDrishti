import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ShieldCheck, Mail, Heart } from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  });

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 w-full space-y-8 text-ink leading-relaxed">
      <header className="space-y-2 border-b border-rule pb-6">
        <span className="text-[11px] font-mono uppercase tracking-wider text-forest-700 font-semibold">
          About the Project
        </span>
        <h1 className="font-serif text-3xl font-semibold text-forest-900">
          Independent Public-Interest Satellite Monitoring
        </h1>
        <p className="text-base text-ink-muted">
          Accessible, verifiable environmental intelligence for researchers, journalists, and civil society.
        </p>
      </header>

      <section className="space-y-4 text-sm text-ink-muted leading-relaxed">
        <h2 className="font-serif text-xl font-semibold text-forest-900">
          Our Mission
        </h2>
        <p>
          Deforestation monitoring often remains siloed behind proprietary enterprise dashboards or complex Earth Engine codebases that require specialized engineering. ForestWatch AI bridges this gap by providing an open, free, and verifiable platform where anyone can examine multi-spectral satellite imagery and trace suspected canopy clearings.
        </p>
        <p>
          We operate under strict data integrity principles. We never simulate detections, inflate statistical accuracy, or label ambiguous vegetation shifts as proven crimes. Every number presented originates from traceable satellite passes and auditable algorithms.
        </p>
      </section>

      <section className="p-5 bg-surface border border-rule rounded space-y-3">
        <div className="flex items-center gap-2 text-forest-900 font-serif font-semibold text-base">
          <Heart className="w-4 h-4 text-forest-700" />
          <span>Independent & Free for Everyone</span>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          ForestWatch AI is free and independent. Contributions are voluntary and cover hosting costs. There are no premium accounts, feature paywalls, or gated datasets.
        </p>
        {config?.supportUrl && (
          <div className="pt-2">
            <a
              href={config.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper border border-rule hover:border-forest-700 rounded text-xs font-medium text-forest-900 transition-colors"
            >
              <span>Support hosting & infrastructure</span>
            </a>
          </div>
        )}
      </section>

      <section className="space-y-3 pt-4 border-t border-rule text-sm text-ink-muted">
        <h2 className="font-serif text-xl font-semibold text-forest-900">
          Contact & Research Collaboration
        </h2>
        <p>
          For academic collaborations, reporting errors in baseline datasets, or proposing high-risk monitoring regions, reach out to our team:
        </p>
        <div className="flex items-center gap-2 font-mono text-xs text-forest-900">
          <Mail className="w-4 h-4 text-ink-muted" />
          <span>{config?.siteContactEmail || 'info@forestwatch.org'}</span>
        </div>
      </section>
    </div>
  );
};
