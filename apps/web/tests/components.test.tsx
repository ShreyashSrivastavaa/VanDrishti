import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MapLegend } from '../src/features/map/MapLegend';
import { DetectionDetailPanel } from '../src/features/map/DetectionDetailPanel';
import { Header } from '../src/components/Header';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Web UI Components', () => {
  it('MapLegend renders active layer indicators and accessibility notice', () => {
    render(
      <MapLegend
        showSatellite={true}
        showForestMask={true}
        showLoss={true}
        showAoiBoundaries={true}
      />
    );

    expect(screen.getByText(/Suspected Forest Loss/i)).toBeDefined();
    expect(screen.getByText(/Forest Cover \(Baseline Reference\)/i)).toBeDefined();
    expect(screen.getByText(/Sentinel-2 True Color/i)).toBeDefined();
    expect(screen.getByText(/color-blind safety/i)).toBeDefined();
  });

  it('MapLegend renders Tree Cover Density gradient, scale stops, and model status caveat', () => {
    render(
      <MapLegend
        showDensity={true}
        showSatellite={false}
        showForestMask={false}
        showLoss={true}
        showAoiBoundaries={true}
        modelName="spectral_baseline"
        modelStatus="baseline"
        observationDate="2023-08-18"
      />
    );

    expect(screen.getByText(/Tree cover density \(~100 m window\)/i)).toBeDefined();
    expect(screen.getByText(/^0%$/)).toBeDefined();
    expect(screen.getByText(/^25%$/)).toBeDefined();
    expect(screen.getByText(/^50%$/)).toBeDefined();
    expect(screen.getByText(/^75%$/)).toBeDefined();
    expect(screen.getByText(/^100%$/)).toBeDefined();
    expect(screen.getByText(/Share of pixels classified as forest by spectral_baseline, baseline\. Not a tree count\. Source: Sentinel-2 2023-08-18\./i)).toBeDefined();
  });

  it('DetectionDetailPanel renders coordinates, area, dates, and explanation', () => {
    const mockDetection = {
      id: 'det-1234',
      centroid: [-63.15123, -9.51234],
      areaHa: 3.45,
      confidenceClass: 'high',
      confidenceScore: 0.88,
      dateT0: '2021-08-15',
      dateT1: '2023-08-18',
      modelStatus: 'baseline',
      explanation: 'Between 2021-08-15 and 2023-08-18, an area of approximately 3.45 ha changed from forest-like to non-forest-like cover.',
      aoiSlug: 'rondonia-jamari',
    };

    renderWithProviders(
      <DetectionDetailPanel detection={mockDetection} onClose={() => {}} />
    );

    expect(screen.getAllByText(/3.45 ha/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/High \(88%\)/i)).toBeDefined();
    expect(screen.getByText(/-9.51234, -63.15123/i)).toBeDefined();
    expect(screen.getAllByText(/2021-08-15/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2023-08-18/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/BASELINE/i)).toBeDefined();
  });

  it('Header renders geometric mark and navigation links', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText(/ForestWatch/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /^Map$/i })).toBeDefined();
    expect(screen.getByText(/Regions/i)).toBeDefined();
    expect(screen.getByText(/Methodology/i)).toBeDefined();
    expect(screen.getByText(/Data & Licences/i)).toBeDefined();
    expect(screen.getByText(/About/i)).toBeDefined();
  });
});
