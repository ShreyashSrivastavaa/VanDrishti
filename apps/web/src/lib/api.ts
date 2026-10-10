import type { 
  Aoi, 
  AoiSummary, 
  Observation, 
  Analysis, 
  Detection, 
  DatasetSource, 
  GeocodeResult, 
  TimeseriesPoint,
  DensitySampleResult
} from '@forestwatch/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export function resolveArtifactUrl(uri?: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
    return uri;
  }
  const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${base}${uri.startsWith('/') ? '' : '/'}${uri}`;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errMessage = `HTTP error ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        errMessage = errBody.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  return res.json();
}

export const api = {
  getConfig: () => fetchJson<{
    supportUrl: string | null;
    enableUserAnalysis: boolean;
    maxUserAoiKm2: number;
    siteContactEmail: string;
    attributions: string[];
  }>(`${API_BASE}/config`),

  getAois: () => fetchJson<AoiSummary[]>(`${API_BASE}/aois`),

  getAoi: (slug: string) => fetchJson<Aoi & {
    latestObservationDate: string | null;
    observationCount: number;
    analysisCount: number;
  }>(`${API_BASE}/aois/${slug}`),

  getAoiObservations: (slug: string, usableOnly = false) => 
    fetchJson<Observation[]>(`${API_BASE}/aois/${slug}/observations${usableOnly ? '?usable=true' : ''}`),

  getObservation: (id: string) =>
    fetchJson<Observation>(`${API_BASE}/observations/${id}`),

  sampleDensity: (obsId: string, lat: number, lon: number) =>
    fetchJson<DensitySampleResult>(`${API_BASE}/observations/${obsId}/sample?lat=${lat}&lon=${lon}`),

  getAoiTimeseries: (slug: string) => 
    fetchJson<TimeseriesPoint[]>(`${API_BASE}/aois/${slug}/timeseries`),

  getAoiAnalyses: (slug: string) => 
    fetchJson<Analysis[]>(`${API_BASE}/aois/${slug}/analyses`),

  getAnalysis: (id: string) => 
    fetchJson<Analysis & {
      aoiSlug: string;
      aoiName: string;
      countryCode: string;
      areaKm2: number;
      dateT0: string;
      dateT1: string;
      previewUriT0?: string;
      previewUriT1?: string;
      previewBoundsT0?: any;
      previewBoundsT1?: any;
      provenanceT0?: any;
      provenanceT1?: any;
      validFractionT0: number;
      validFractionT1: number;
      modelName: string;
      modelVersion: string;
      modelStatus: string;
      modelMetrics?: any;
    }>(`${API_BASE}/analyses/${id}`),

  getAnalysisDetections: (id: string, minAreaHa = 0, confidenceClass?: string) => {
    const params = new URLSearchParams();
    if (minAreaHa > 0) params.append('minAreaHa', minAreaHa.toString());
    if (confidenceClass) params.append('confidenceClass', confidenceClass);
    return fetchJson<{
      type: 'FeatureCollection';
      features: Array<{
        type: 'Feature';
        id: string;
        geometry: any;
        properties: any;
      }>;
    }>(`${API_BASE}/analyses/${id}/detections?${params.toString()}`);
  },

  getDetection: (id: string) => 
    fetchJson<Detection & {
      dateT0: string;
      dateT1: string;
      aoiSlug: string;
      aoiName: string;
      modelStatus: string;
      previewUriT0?: string;
      previewUriT1?: string;
      sceneIdsT0?: string[];
      sceneIdsT1?: string[];
    }>(`${API_BASE}/detections/${id}`),

  getDatasetSources: () => 
    fetchJson<DatasetSource[]>(`${API_BASE}/dataset_sources`),

  geocode: (query: string) => 
    fetchJson<GeocodeResult[]>(`${API_BASE}/geocode?q=${encodeURIComponent(query)}`),

  requestAnalysis: (slug: string, payload: { t0: string; t1: string; params?: any }) => 
    fetchJson<any>(`${API_BASE}/aois/${slug}/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
