import { MARS_RADII } from '../data/marsData';
import type { ImageryLayerId } from '../types/mars';

/**
 * Computes spherical geodesic distance between two Mars coordinates using IAU mean radius.
 */
export function marsGeodesicDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return MARS_RADII.meanKm * c;
}

export function formatAreographicCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir} · ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

function gaussianPeak(
  lat: number,
  lon: number,
  cLat: number,
  cLon: number,
  sigmaLat: number,
  sigmaLon: number,
  amp: number
): number {
  let dLon = lon - cLon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dLat = lat - cLat;
  const exponent = -(
    (dLat * dLat) / (2 * sigmaLat * sigmaLat) +
    (dLon * dLon) / (2 * sigmaLon * sigmaLon)
  );
  return amp * Math.exp(exponent);
}

/**
 * Calibrated Martian topographic elevation model (km relative to MOLA datum).
 * Captures hemispheric dichotomy, Tharsis bulge, Olympus Mons, Elysium Rise,
 * Valles Marineris rift, Hellas/Argyre/Isidis basins, and polar caps.
 */
export function estimateMarsElevationKm(lat: number, lon: number): number {
  // Hemispheric dichotomy: southern highlands higher, northern lowlands lower
  let elev = lat > 15 ? -3.4 : lat < -10 ? 1.4 : -0.8 - (lat / 25) * 1.4;

  // Tharsis Bulge & Olympus Mons
  elev += gaussianPeak(lat, lon, 0, -110, 26, 36, 7.2);
  elev += gaussianPeak(lat, lon, 18.65, -133.8, 3.2, 3.5, 16.5); // Olympus Mons
  elev += gaussianPeak(lat, lon, 11.8, -104.0, 2.5, 2.5, 7.5); // Ascraeus
  elev += gaussianPeak(lat, lon, 1.5, -113.4, 2.4, 2.4, 6.8); // Pavonis
  elev += gaussianPeak(lat, lon, -8.3, -120.1, 2.8, 2.8, 8.2); // Arsia

  // Elysium Rise
  elev += gaussianPeak(lat, lon, 25.0, 147.2, 6, 7, 10.2);

  // Valles Marineris canyon trough
  elev += gaussianPeak(lat, lon, -11.0, -68.0, 3.0, 19.0, -6.2);

  // Major Impact Basins
  elev += gaussianPeak(lat, lon, -42.4, 70.5, 13.0, 16.0, -8.3); // Hellas
  elev += gaussianPeak(lat, lon, -49.7, -43.0, 7.5, 9.0, -5.2); // Argyre
  elev += gaussianPeak(lat, lon, 12.9, 87.0, 8.5, 9.5, -4.4); // Isidis

  // Polar caps
  if (lat > 78) elev += (lat - 78) * 0.28;
  if (lat < -78) elev += (-78 - lat) * 0.22;

  // Subtle multi-frequency surface roughness
  const ripple =
    0.35 * Math.sin((lat * Math.PI) / 14) * Math.cos((lon * Math.PI) / 18) +
    0.18 * Math.sin((lat * Math.PI) / 5 + (lon * Math.PI) / 7);

  return Number((elev + ripple).toFixed(2));
}

export function estimateMarsSlopeDeg(lat: number, lon: number): number {
  const step = 0.25;
  const e0 = estimateMarsElevationKm(lat, lon);
  const eN = estimateMarsElevationKm(lat + step, lon);
  const eE = estimateMarsElevationKm(lat, lon + step);
  const kmPerDeg = (2 * Math.PI * MARS_RADII.meanKm) / 360;
  const dx = step * kmPerDeg;
  const grad = Math.sqrt(Math.pow((eN - e0) / dx, 2) + Math.pow((eE - e0) / dx, 2));
  const deg = (Math.atan(grad) * 180) / Math.PI;
  return Number(Math.max(0.4, Math.min(28, deg * 3.5)).toFixed(1));
}

// Color ramps for MOLA elevation & THEMIS thermal IR procedural fallback layers
function molaRamp(elevKm: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (elevKm + 8) / 22));
  if (t < 0.2) {
    const k = t / 0.2;
    return [34 + k * 24, 48 + k * 65, 138 + k * 55]; // Deep blue-indigo
  }
  if (t < 0.45) {
    const k = (t - 0.2) / 0.25;
    return [58 + k * 70, 113 + k * 90, 193 - k * 85]; // Cyan-teal-green
  }
  if (t < 0.7) {
    const k = (t - 0.45) / 0.25;
    return [128 + k * 105, 203 - k * 45, 108 - k * 68]; // Yellow-amber
  }
  if (t < 0.88) {
    const k = (t - 0.7) / 0.18;
    return [233 - k * 30, 158 - k * 95, 40 + k * 10]; // Burnt orange-red
  }
  const k = (t - 0.88) / 0.12;
  return [203 + k * 48, 63 + k * 175, 50 + k * 195]; // High volcanic white-magenta
}

const cachedTextures: Partial<Record<ImageryLayerId, string>> = {};

/**
 * Generates an equirectangular Martian surface texture (1024x512) encoding real
 * Martian topography and albedo features so CesiumJS always has a rich base layer.
 */
export function getProceduralMarsTexture(mode: ImageryLayerId): string {
  if (cachedTextures[mode]) return cachedTextures[mode]!;

  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(width, height);
  const data = img.data;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / (height - 1)) * 180;
    for (let x = 0; x < width; x++) {
      const lon = -180 + (x / (width - 1)) * 360;
      const elev = estimateMarsElevationKm(lat, lon);

      // Compute hillshade normal
      const eRight = estimateMarsElevationKm(lat, lon + 0.7);
      const eDown = estimateMarsElevationKm(lat - 0.7, lon);
      const shade = Math.max(0.55, Math.min(1.28, 0.92 + (eRight - elev) * 0.28 - (eDown - elev) * 0.22));

      let r = 180;
      let g = 98;
      let b = 64;

      if (mode === 'mola') {
        [r, g, b] = molaRamp(elev);
        r *= shade;
        g *= shade;
        b *= shade;
      } else if (mode === 'themis') {
        const thermal = 115 + elev * 4.5 + Math.sin((lon * Math.PI) / 22) * 14;
        const val = Math.max(40, Math.min(235, thermal * shade));
        r = val * 1.04;
        g = val * 0.96;
        b = val * 0.92;
      } else {
        // Viking Color Mosaic: authentic dark basaltic albedo patches (Syrtis Major, Acidalia, Solis)
        const syrtisDark = gaussianPeak(lat, lon, 9, 68, 12, 14, 1);
        const acidaliaDark = gaussianPeak(lat, lon, 46, -24, 16, 26, 1);
        const mareErythraeum = gaussianPeak(lat, lon, -22, -28, 13, 32, 0.85);
        const dustBright = gaussianPeak(lat, lon, 12, -135, 22, 34, 0.45);
        const darkFactor = Math.min(0.45, (syrtisDark + acidaliaDark + mareErythraeum) * 0.42);

        r = (196 - darkFactor * 125 + dustBright * 32) * shade;
        g = (112 - darkFactor * 72 + dustBright * 26) * shade;
        b = (72 - darkFactor * 42 + dustBright * 16) * shade;

        // Polar ice caps
        const iceThreshold = 80 + Math.sin((lon * Math.PI) / 45) * 2.2;
        if (Math.abs(lat) > iceThreshold) {
          const cap = Math.min(1, (Math.abs(lat) - iceThreshold) / 4.5);
          r = r * (1 - cap) + 236 * cap;
          g = g * (1 - cap) + 232 * cap;
          b = b * (1 - cap) + 228 * cap;
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/jpeg', 0.88);
  cachedTextures[mode] = url;
  return url;
}
