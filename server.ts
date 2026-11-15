import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const NASA_TILE_URLS: Record<string, (z: string, y: string, x: string) => string> = {
  viking: (z, y, x) =>
    `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`,
  mola: (z, y, x) =>
    `https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`,
  themis: (z, y, x) =>
    `https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/${z}/${y}/${x}.png`,
};

// Simple bounded in-memory tile cache to reduce upstream latency
const tileCache = new Map<string, { contentType: string; buffer: Buffer }>();
const MAX_TILE_CACHE = 400;

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Serve Cesium static workers/assets/widgets directly in both dev and prod
  const cesiumStaticDir = path.join(__dirname, 'node_modules/cesium/Build/Cesium');
  app.use('/cesiumStatic', express.static(cesiumStaticDir, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'martian-map', timestamp: new Date().toISOString() });
  });

  // NASA Mars Trek WMTS Proxy
  app.get('/api/mars/tile/:layer/:z/:y/:x', async (req, res) => {
    const { layer, z, y, x } = req.params;
    const urlBuilder = NASA_TILE_URLS[layer];
    if (!urlBuilder) {
      res.status(400).json({ error: 'Unknown Mars layer' });
      return;
    }

    const cleanX = x.replace(/\.(jpg|png)$/i, '');
    const cacheKey = `${layer}/${z}/${y}/${cleanX}`;
    const cached = tileCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached.buffer);
      return;
    }

    const targetUrl = urlBuilder(z, y, cleanX);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const upstream = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MartianMap-NASA-SpaceApps/1.0' },
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        res.status(404).end();
        return;
      }

      const contentType = upstream.headers.get('content-type') || (layer === 'themis' ? 'image/png' : 'image/jpeg');
      const arrayBuf = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (tileCache.size >= MAX_TILE_CACHE) {
        const oldestKey = tileCache.keys().next().value;
        if (oldestKey) tileCache.delete(oldestKey);
      }
      tileCache.set(cacheKey, { contentType, buffer });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch {
      res.status(404).end();
    }
  });

  // NASA Image & Video Library proxy for verified planetary imagery
  app.get('/api/mars/nasa-media', async (req, res) => {
    const query = String(req.query.q || 'Mars Perseverance HiRISE').trim();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=12`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(502).json({ error: `NASA API returned ${response.status}` });
        return;
      }

      const data = await response.json();
      const rawItems = data?.collection?.items ?? [];
      const items = rawItems.slice(0, 9).map((item: any) => {
        const meta = item.data?.[0] ?? {};
        const thumb = item.links?.find((l: any) => l.rel === 'preview')?.href || '';
        return {
          nasaId: meta.nasa_id || '',
          title: meta.title || 'Mars Observation',
          description: (meta.description || '').slice(0, 220),
          dateCreated: meta.date_created ? meta.date_created.slice(0, 10) : '',
          center: meta.center || 'NASA/JPL',
          thumbnailUrl: thumb,
        };
      }).filter((item: any) => item.thumbnailUrl);

      res.json({ query, count: items.length, items });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to query NASA Image Library' });
    }
  });

  // Gemini AI Planetary Science & Mission Readiness Analyst
  app.post('/api/mars/analyze', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      return;
    }

    const {
      siteName,
      lat,
      lon,
      elevationKm,
      epoch,
      mineralogy,
      question,
      mode = 'site',
      waypoints = [],
      totalDistanceKm,
    } = req.body ?? {};

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
      return;
    }

    const waypointSummary = Array.isArray(waypoints) && waypoints.length > 0
      ? `Planned Rover Traverse Waypoints (${waypoints.length} points, total ${Number(totalDistanceKm || 0).toFixed(2)} km):\n` +
        waypoints
          .map((wp: any, i: number) => `  WP-${String(i + 1).padStart(2, '0')}: ${wp.lat.toFixed(3)}°, ${wp.lon.toFixed(3)}° (est. elev ${wp.elevationKm?.toFixed(2) ?? 'N/A'} km)`)
          .join('\n')
      : '';

    const prompt = [
      `Analyze the following Martian region/mission plan from a planetary geologist and NASA mission systems engineer perspective.`,
      `Target: ${siteName || 'Custom Areographic Coordinate'}`,
      `Areographic Coordinates: ${lat.toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}, ${lon.toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`,
      elevationKm !== undefined ? `MOLA Elevation Datum: ${elevationKm} km` : '',
      epoch ? `Geological Epoch: ${epoch}` : '',
      mineralogy ? `Known / Orbital Mineralogy: ${mineralogy}` : '',
      waypointSummary,
      `Analysis Mode: ${mode}`,
      question ? `Specific Inquiry: ${question}` : 'Provide a rigorous geological, astrobiological/ISRU, and landing/traverse engineering analysis.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a senior Mars planetary geologist and aerospace mission systems engineer supporting NASA Space Apps Challenge researchers. Be concise, scientifically accurate, quantitative (using km, m, Pa, tiu, K, deg, wt% H2O), and grounded in real Martian geomorphology (MOLA, CRISM, THEMIS, HiRISE, SHARAD datasets). Avoid generic filler or hype.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: {
                type: Type.STRING,
                description: 'Concise 6-10 word scientific finding headline.',
              },
              geologicalContext: {
                type: Type.STRING,
                description: '2-3 sentences on geomorphology, stratigraphy, and inferred mineralogical history.',
              },
              astrobiologyAndResources: {
                type: Type.STRING,
                description: '2 sentences on biosignature preservation potential or subsurface water-ice / ISRU utility.',
              },
              engineeringAssessment: {
                type: Type.STRING,
                description: '2-3 sentences on landing ellipse hazards, slope/roughness, dust optical depth, thermal environment, and solar insolation.',
              },
              recommendedInstruments: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 4 concrete scientific or ISRU instruments suited for this site.',
              },
              confidenceNote: {
                type: Type.STRING,
                description: '1 short sentence noting orbital sensor resolution or uncertainty factors.',
              },
            },
            required: [
              'headline',
              'geologicalContext',
              'astrobiologyAndResources',
              'engineeringAssessment',
              'recommendedInstruments',
              'confidenceNote',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate planetary analysis';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Martian Map server listening on http://localhost:${PORT}`);
  });
}

createServer();
