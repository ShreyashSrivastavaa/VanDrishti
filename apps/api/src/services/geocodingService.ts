interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
}

const cache = new Map<string, { timestamp: number; data: GeocodeResult[] }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let lastRequestTime = 0;

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  // Check cache
  const cached = cache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Rate limiting compliance: at least 1000ms between upstream requests
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastRequestTime = Date.now();

  const baseUrl = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org';
  const userAgent = process.env.GEOCODER_USER_AGENT || 'ForestWatchAI/0.1 (contact: info@forestwatch.org)';

  const url = `${baseUrl}/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status} ${response.statusText}`);
    }

    const items = await response.json() as any[];
    const results: GeocodeResult[] = items.map(item => {
      // Nominatim returns boundingbox as [minLat, maxLat, minLon, maxLon] strings
      const bb = item.boundingbox;
      const minLat = parseFloat(bb[0]);
      const maxLat = parseFloat(bb[1]);
      const minLon = parseFloat(bb[2]);
      const maxLon = parseFloat(bb[3]);
      
      return {
        label: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        bbox: [minLon, minLat, maxLon, maxLat],
      };
    });

    cache.set(normalizedQuery, { timestamp: Date.now(), data: results });
    return results;
  } catch (err) {
    console.error('Geocoding error:', err);
    return [];
  }
}
