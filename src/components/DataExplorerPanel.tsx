import React, { useEffect, useState } from 'react';
import { Globe, Image as ImageIcon, Loader2, Search } from 'lucide-react';
import { MARS_DIURNAL_TELEMETRY, MARS_GLOBAL_CONSTANTS } from '../data/marsData';
import type { NasaMediaItem } from '../types/mars';

const PRESET_NASA_QUERIES = [
  'Perseverance Jezero',
  'Mars HiRISE Crater',
  'Valles Marineris',
  'Olympus Mons',
];

export const DataExplorerPanel: React.FC = () => {
  const [query, setQuery] = useState('Perseverance Jezero');
  const [items, setItems] = useState<NasaMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverHourIdx, setHoverHourIdx] = useState<number | null>(null);

  const fetchNasaMedia = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mars/nasa-media?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('NASA Image Library request failed');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load NASA media');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNasaMedia('Perseverance Jezero');
  }, []);

  // Diurnal temperature SVG coordinates
  const w = 264;
  const h = 92;
  const padX = 12;
  const padY = 12;
  const minT = -95;
  const maxT = 5;
  const points = MARS_DIURNAL_TELEMETRY.map((d, i) => {
    const x = padX + (i / (MARS_DIURNAL_TELEMETRY.length - 1)) * (w - padX * 2);
    const y = h - padY - ((d.tempC - minT) / (maxT - minT)) * (h - padY * 2);
    return { x, y, ...d };
  });
  const tempPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="border-b border-slate-200 dark:border-slate-800/80 p-4">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          Planetary Data Explorer
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          NASA imagery archive, planetary constants &amp; diurnal weather
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Diurnal Weather Curve */}
        <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Equatorial Diurnal Temp &amp; Pressure
            </span>
            <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
              {hoverHourIdx !== null
                ? `${points[hoverHourIdx].hour}:00 · ${points[hoverHourIdx].tempC}°C · ${points[hoverHourIdx].pressurePa} Pa`
                : '-89°C to -4°C'}
            </span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-22 overflow-visible">
            <line
              x1={padX}
              y1={h - padY}
              x2={w - padX}
              y2={h - padY}
              stroke="rgba(148,163,184,0.2)"
              strokeWidth="1"
            />
            <path d={tempPath} fill="none" stroke="#E05A2B" strokeWidth="1.75" />
            {points.map((pt, i) => (
              <circle
                key={pt.hour}
                cx={pt.x}
                cy={pt.y}
                r={hoverHourIdx === i ? 4 : 2.3}
                fill={hoverHourIdx === i ? '#06B6D4' : '#E05A2B'}
                className="cursor-pointer"
                onMouseEnter={() => setHoverHourIdx(i)}
                onMouseLeave={() => setHoverHourIdx(null)}
              />
            ))}
          </svg>
        </div>

        {/* Mars Planetary Physical Constants */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Mars Physical &amp; Orbital Constants
          </div>
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80 rounded-md border border-slate-200 dark:border-slate-800">
            {MARS_GLOBAL_CONSTANTS.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
              >
                <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 text-right">
                  {row.value}{' '}
                  <span className="text-[10px] text-slate-400">{row.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live NASA Image & Video Library Feed */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              NASA Planetary Image Archive
            </span>
            <Globe className="h-3.5 w-3.5 text-slate-400" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) fetchNasaMedia(query.trim());
            }}
            className="flex gap-1.5"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Query NASA archive..."
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] py-1.5 pl-8 pr-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-[#E05A2B] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#E05A2B] transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-1">
            {PRESET_NASA_QUERIES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setQuery(preset);
                  fetchNasaMedia(preset);
                }}
                className="rounded border border-slate-200 dark:border-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 hover:border-[#E05A2B]/60 hover:text-slate-900 dark:hover:text-slate-100"
              >
                {preset}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#E05A2B]" />
              Querying NASA Image Library...
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
              {error}
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.nasaId || item.title}
                  className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14]"
                >
                  <div className="relative h-28 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <ImageIcon className="h-5 w-5 text-slate-600 absolute -z-0" />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {item.title}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {item.center} · {item.dateCreated}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
