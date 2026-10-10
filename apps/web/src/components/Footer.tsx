import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <footer className="bg-surface border-t border-rule mt-auto py-8 px-4 sm:px-6 text-[12px] text-ink-muted">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Language discipline & Caveat Box */}
        <div className="p-3.5 bg-paper border border-rule rounded flex items-start gap-3">
          <Info className="w-4 h-4 text-warn-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-ink">
              Observational Transparency & Language Discipline
            </p>
            <p className="leading-relaxed">
              All events identified by ForestWatch AI are classified as <strong className="text-ink">suspected forest loss</strong> or <strong className="text-ink">detected spectral change</strong>. Surface reflectance changes may be caused by seasonal phenology, agricultural harvest cycles, fire scars, or cloud shadow artifacts. Satellite observations do not constitute definitive legal proof of deforestation without local validation.
            </p>
          </div>
        </div>

        {/* Links & Attributions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-rule/60">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>© {new Date().getFullYear()} ForestWatch AI — Free & Open Environmental Tool</span>
            <Link to="/methodology" className="hover:text-forest-700 underline underline-offset-2">
              Scientific Methodology
            </Link>
            <Link to="/data-licences" className="hover:text-forest-700 underline underline-offset-2">
              Data & Licences
            </Link>
            <Link to="/about" className="hover:text-forest-700 underline underline-offset-2">
              Mission & Limitations
            </Link>
            {config?.supportUrl && (
              <a
                href={config.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-forest-700 underline underline-offset-2"
              >
                Support this project
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 text-ink">
            <ShieldCheck className="w-4 h-4 text-forest-700" />
            <span className="font-mono text-[11px]">Contains modified Copernicus Sentinel data</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
