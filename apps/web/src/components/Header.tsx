import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ExternalLink, Compass } from 'lucide-react';

export const Header: React.FC = () => {
  const location = useLocation();
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    staleTime: 10 * 60 * 1000,
  });

  const navLinks = [
    { to: '/map', label: 'Map' },
    { to: '/regions', label: 'Regions' },
    { to: '/methodology', label: 'Methodology' },
    { to: '/data-licences', label: 'Data & Licences' },
    { to: '/about', label: 'About' },
  ];

  return (
    <header className="h-13 bg-surface border-b border-rule flex items-center justify-between px-4 sm:px-6 select-none z-30 sticky top-0">
      {/* Brand & Wordmark */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 text-forest-900 group">
          {/* Geometric mark: 2x2 grid representing pixel monitoring */}
          <div className="w-5 h-5 bg-forest-900 p-0.5 rounded-sm flex flex-col justify-between" aria-hidden="true">
            <div className="flex justify-between h-1.5">
              <div className="w-1.5 bg-paper rounded-[1px]" />
              <div className="w-1.5 bg-olive-600 rounded-[1px]" />
            </div>
            <div className="flex justify-between h-1.5">
              <div className="w-1.5 bg-olive-600 rounded-[1px]" />
              <div className="w-1.5 bg-loss-600 rounded-[1px]" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-semibold text-[15px] tracking-tight leading-none text-forest-900 group-hover:text-forest-700">
              ForestWatch <span className="font-sans font-medium text-[11px] tracking-widest text-ink-muted uppercase ml-0.5">AI</span>
            </span>
            <span className="text-[10px] text-ink-muted tracking-wider uppercase font-mono mt-0.5">
              Copernicus Sentinel-2 Observatory
            </span>
          </div>
        </Link>

        {/* Primary Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`text-[13px] px-2.5 py-1 rounded transition-colors ${
                  isActive
                    ? 'font-semibold text-forest-900 bg-olive-200/50'
                    : 'text-ink-muted hover:text-ink hover:bg-paper'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Actions: Support & Fast Map CTA */}
      <div className="flex items-center gap-3">
        {config?.supportUrl && (
          <a
            href={config.supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-forest-900 hover:text-forest-700 px-2.5 py-1 rounded border border-rule hover:border-forest-700 transition-colors flex items-center gap-1"
            title="Support this independent public-interest research project"
          >
            <span>Support this project</span>
            <ExternalLink className="w-3 h-3 text-ink-muted" />
          </a>
        )}

        <Link
          to="/map"
          className="text-[12px] font-medium bg-forest-900 text-paper hover:bg-forest-700 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Open Map</span>
        </Link>
      </div>
    </header>
  );
};
