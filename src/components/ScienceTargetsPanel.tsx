import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Compass } from 'lucide-react';
import { MARS_SITES } from '../data/marsData';
import type { MarsSite } from '../types/mars';
import { formatAreographicCoord } from '../utils/marsGeo';

interface ScienceTargetsPanelProps {
  selectedSiteId: string | null;
  onSelectSite: (site: MarsSite) => void;
  onAnalyzeSite: (site: MarsSite, focusQuestion: string) => void;
}

type EpochFilter = 'All' | 'Noachian' | 'Hesperian' | 'Amazonian';

export const ScienceTargetsPanel: React.FC<ScienceTargetsPanelProps> = ({
  selectedSiteId,
  onSelectSite,
  onAnalyzeSite,
}) => {
  const [epochFilter, setEpochFilter] = useState<EpochFilter>('All');

  const targets = useMemo(() => {
    return MARS_SITES.filter((s) => epochFilter === 'All' || s.epoch === epochFilter);
  }, [epochFilter]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="border-b border-slate-200 dark:border-slate-800/80 px-3.5 py-3.5 space-y-2.5">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
            Science Targets
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Mineralogy, stratigraphy &amp; astrobiology regions
          </p>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {(['All', 'Noachian', 'Hesperian', 'Amazonian'] as const).map((epoch) => (
            <button
              key={epoch}
              type="button"
              onClick={() => setEpochFilter(epoch)}
              className={`whitespace-nowrap shrink-0 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                epochFilter === epoch
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
              }`}
            >
              {epoch}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/60">
        {targets.map((site) => {
          const isSelected = site.id === selectedSiteId;
          return (
            <div
              key={site.id}
              className={`px-3.5 py-3 space-y-2 transition-colors ${
                isSelected ? 'bg-[#E05A2B]/10' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectSite(site)}
                  className="text-left group"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[#E05A2B] transition-colors">
                    {site.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {site.epoch} · {formatAreographicCoord(site.lat, site.lon)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSite(site)}
                  title="Fly to target on globe"
                  className="shrink-0 rounded border border-slate-200 dark:border-slate-800 p-1.5 text-slate-500 hover:text-sky-400 hover:border-sky-500/50 transition-colors"
                >
                  <Compass className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                {site.mineralogy}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px] font-mono tabular-nums text-sky-600 dark:text-sky-400">
                <div>Elev {site.elevationKm > 0 ? '+' : ''}{site.elevationKm.toFixed(2)} km</div>
                <div>Inertia {site.thermalInertia} tiu</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectSite(site);
                  onAnalyzeSite(
                    site,
                    `Decode the CRISM/THEMIS mineralogy (${site.mineralogy}) and astrobiological preservation potential at ${site.name}.`
                  );
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E05A2B] hover:underline pt-0.5"
              >
                Decode Spectral Profile
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
