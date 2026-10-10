import React from 'react';

export const MethodologyPage: React.FC = () => {
  return (
    <article className="max-w-3xl mx-auto py-12 px-4 sm:px-6 w-full space-y-10 text-ink leading-relaxed">
      <header className="space-y-3 border-b border-rule pb-8">
        <span className="text-[11px] font-mono uppercase tracking-wider text-forest-700 font-semibold">
          Scientific Whitepaper & Technical Specifications
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-forest-900 leading-tight">
          Methodology: Multi-Spectral Canopy Change Detection
        </h1>
        <p className="text-base text-ink-muted leading-relaxed font-sans">
          How ForestWatch AI transforms Copernicus Sentinel-2 Level-2A optical surface reflectance into verifiable, cloud-screened forest loss detections.
        </p>
      </header>

      {/* 1. Sentinel-2 Acquisition & Cloud Screening */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">
          1. Satellite Ingestion & SCL Masking
        </h2>
        <p className="text-sm text-ink-muted">
          We process Sentinel-2 Level-2A Bottom-Of-Atmosphere (BOA) surface reflectance directly from open AWS STAC catalogues using Cloud-Optimized GeoTIFF (COG) HTTP range requests. Only the exact bounding box covering an Area of Interest is read, eliminating full-tile bandwidth overhead.
        </p>
        <p className="text-sm text-ink-muted">
          Optical satellite observations in the tropics are frequently obscured by cumulus cloud formations and convective cloud shadows. To ensure data integrity, every pixel is screened against the 20-meter Scene Classification Layer (SCL):
        </p>
        <div className="p-4 bg-surface border border-rule rounded text-xs space-y-2">
          <div className="font-mono text-[11px] font-semibold text-ink">
            Masked SCL Pixel Classes:
          </div>
          <ul className="list-disc pl-5 text-ink-muted space-y-1 font-mono text-[11px]">
            <li>Class 0: No Data / Missing Pixels</li>
            <li>Class 1: Saturated or Defective Radiance</li>
            <li>Class 3: Cloud Shadows</li>
            <li>Class 8 & 9: Medium and High Probability Clouds</li>
            <li>Class 10: Thin Cirrus High-Altitude Clouds</li>
            <li>Class 11: Snow and Glacial Ice</li>
          </ul>
          <p className="pt-2 text-ink-muted text-[11px]">
            A morphological binary dilation of 2 pixels (~20 meters) is applied around all cloud and shadow edges to suppress optical diffraction artifacts.
          </p>
        </div>
      </section>

      {/* 2. Spectral Indices */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">
          2. Spectral Index Modeling & Normalization
        </h2>
        <p className="text-sm text-ink-muted">
          Sentinel-2 MSI bands B02 (Blue), B03 (Green), B04 (Red), and B08 (Near-Infrared) operate at 10-meter spatial resolution. Short-Wave Infrared bands B11 (1.61 µm) and B12 (2.19 µm) operate at 20-meter resolution and are bilinearly resampled to 10 meters.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-surface border border-rule rounded">
            <span className="font-semibold text-forest-900 block text-[11px]">NDVI (Vegetation Vigor)</span>
            <span className="text-ink-muted block mt-1">(B08 − B04) / (B08 + B04)</span>
          </div>
          <div className="p-3 bg-surface border border-rule rounded">
            <span className="font-semibold text-forest-900 block text-[11px]">NBR (Burn & Moisture)</span>
            <span className="text-ink-muted block mt-1">(B08 − B12) / (B08 + B12)</span>
          </div>
        </div>
      </section>

      {/* 3. Change Detection & Hysteresis */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">
          3. Bi-Temporal Hysteresis & MMU Filtering
        </h2>
        <p className="text-sm text-ink-muted">
          Simple pixel-differencing creates noisy boundary flicker due to slight sub-pixel co-registration offsets and shadow elongation. ForestWatch AI implements a strict hysteresis gap between two observation passes (t0 and t1):
        </p>
        <ul className="list-disc pl-5 text-sm text-ink-muted space-y-2">
          <li>
            <strong className="text-ink">High Forest at t0:</strong> The earlier observation must exhibit forest probability <code className="font-mono text-xs">p_forest(t0) ≥ 0.70</code>.
          </li>
          <li>
            <strong className="text-ink">Low Forest at t1:</strong> The subsequent observation must exhibit forest probability <code className="font-mono text-xs">p_forest(t1) ≤ 0.30</code>.
          </li>
          <li>
            <strong className="text-ink">Minimum NDVI Drop:</strong> A spectral decrease of <code className="font-mono text-xs">ΔNDVI ≤ −0.15</code> is enforced.
          </li>
          <li>
            <strong className="text-ink">Minimum Mapping Unit (MMU):</strong> Morphological opening and connected-component analysis remove all isolated clusters smaller than <strong>0.50 hectares (5,000 m²)</strong>.
          </li>
        </ul>
      </section>

      {/* 4. Known Confounds */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">
          4. Known False-Positive Confounds
        </h2>
        <p className="text-sm text-ink-muted">
          Our platform maintains uncompromising language discipline. Spectral loss indicates canopy vegetation change, not legal culpability. Users must consider the following environmental phenomena:
        </p>
        <div className="space-y-2.5 text-xs">
          <div className="p-3 bg-surface border border-rule rounded">
            <span className="font-semibold text-ink">Seasonal Phenology (Leaf-off in Deciduous Stands):</span>
            <p className="text-ink-muted mt-0.5">Dry-season canopy shedding in tropical dry forests mimics clearing. Comparisons should prioritize anniversary dates within ±45 days of year.</p>
          </div>
          <div className="p-3 bg-surface border border-rule rounded">
            <span className="font-semibold text-ink">Wildfire & Burn Scars:</span>
            <p className="text-ink-muted mt-0.5">Fires scorch surface vegetation rapidly. These events are flagged as potential burn scars via severe NBR drop.</p>
          </div>
          <div className="p-3 bg-surface border border-rule rounded">
            <span className="font-semibold text-ink">Commercial Tree Plantations:</span>
            <p className="text-ink-muted mt-0.5">Eucalyptus, pine, or oil palm timber cycles undergo scheduled rotational clear-felling and replanting.</p>
          </div>
        </div>
      </section>
    </article>
  );
};
