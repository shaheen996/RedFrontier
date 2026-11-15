import React, { useMemo, useState } from 'react';
import {
  Compass,
  Cpu,
  Database,
  Flame,
  Layers,
  Mountain,
  Route,
  Search,
  Snowflake,
  Target,
} from 'lucide-react';
import { MARS_SITES } from '../data/marsData';
import type {
  ImageryLayerId,
  MapOverlayState,
  MarsSite,
  SidebarSection,
  SiteCategory,
} from '../types/mars';
import { formatAreographicCoord } from '../utils/marsGeo';

interface LeftSidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
  selectedSiteId: string | null;
  onSelectSite: (site: MarsSite) => void;
  activeLayer: ImageryLayerId;
  onLayerChange: (layer: ImageryLayerId) => void;
  overlays: MapOverlayState;
  onToggleOverlay: (key: keyof MapOverlayState) => void;
  imageryOpacity: number;
  onImageryOpacityChange: (val: number) => void;
  sunAngleDeg: number;
  onSunAngleChange: (val: number) => void;
  children?: React.ReactNode;
}

const SIDEBAR_TABS: { id: SidebarSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'explore', label: 'Explore Mars', icon: Compass },
  { id: 'layers', label: 'Map Layers', icon: Layers },
  { id: 'science', label: 'Science Targets', icon: Target },
  { id: 'planner', label: 'Mission Planner', icon: Route },
  { id: 'data', label: 'Data Explorer', icon: Database },
];

const CATEGORIES: { id: SiteCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'rover', label: 'Rovers' },
  { id: 'volcanic', label: 'Volcanic' },
  { id: 'canyon', label: 'Canyons' },
  { id: 'ice', label: 'Ice Sites' },
];

function CategoryIcon({ category, selected }: { category: MarsSite['category']; selected: boolean }) {
  const cls = `h-3.5 w-3.5 shrink-0 ${
    selected
      ? 'text-[#E05A2B]'
      : category === 'ice'
      ? 'text-sky-400'
      : category === 'rover'
      ? 'text-[#E05A2B]/80'
      : 'text-slate-400'
  }`;
  if (category === 'rover') return <Cpu className={cls} />;
  if (category === 'volcanic') return <Flame className={cls} />;
  if (category === 'ice') return <Snowflake className={cls} />;
  return <Mountain className={cls} />;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeSection,
  onSectionChange,
  selectedSiteId,
  onSelectSite,
  activeLayer,
  onLayerChange,
  overlays,
  onToggleOverlay,
  imageryOpacity,
  onImageryOpacityChange,
  sunAngleDeg,
  onSunAngleChange,
  children,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<SiteCategory>('all');

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MARS_SITES.filter((site) => {
      if (category !== 'all' && site.category !== category) return false;
      if (!q) return true;
      return (
        site.name.toLowerCase().includes(q) ||
        site.region.toLowerCase().includes(q) ||
        site.mineralogy.toLowerCase().includes(q) ||
        (site.missionHistory || '').toLowerCase().includes(q)
      );
    });
  }, [searchQuery, category]);

  return (
    <aside className="flex h-full w-full lg:w-[280px] xl:w-[296px] shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090F1C] overflow-hidden">
      {/* Compact Vertical Exploration Tool Rail */}
      <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#060A14] py-3">
        {SIDEBAR_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSectionChange(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                active
                  ? 'bg-[#E05A2B]/15 text-[#E05A2B] border border-[#E05A2B]/40'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {/* Section Content Body */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {activeSection === 'explore' && (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="border-b border-slate-200 dark:border-slate-800/80 px-3.5 py-3.5 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                  Exploration Sites
                </h2>
                <span className="font-mono tabular-nums text-[11px] text-sky-600 dark:text-sky-400">
                  {filteredSites.length} targets
                </span>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search craters, rovers, minerals..."
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] py-1.5 pl-8 pr-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`whitespace-nowrap shrink-0 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      category === cat.id
                        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/60">
              {filteredSites.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No Martian locations match your query.
                </div>
              ) : (
                filteredSites.map((site) => {
                  const selected = site.id === selectedSiteId;
                  return (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => onSelectSite(site)}
                      className={`w-full text-left px-3.5 py-2.5 transition-colors ${
                        selected
                          ? 'bg-[#E05A2B]/12 dark:bg-[#E05A2B]/14'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIcon category={site.category} selected={selected} />
                          <span
                            className={`text-xs font-semibold truncate ${
                              selected
                                ? 'text-[#E05A2B]'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {site.name}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono tabular-nums text-[10px] text-sky-600 dark:text-sky-400">
                          {site.elevationKm > 0 ? '+' : ''}
                          {site.elevationKm.toFixed(1)}km
                        </span>
                      </div>

                      <div className="mt-1 pl-5.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 truncate">
                          {site.epoch} · {site.region}
                        </span>
                      </div>

                      <div className="mt-0.5 pl-5.5 font-mono tabular-nums text-[10px] text-slate-500 dark:text-slate-400">
                        {formatAreographicCoord(site.lat, site.lon)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeSection === 'layers' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
            <div>
              <h2 className="font-display text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                Map Layers &amp; Overlays
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                NASA Mars Trek WMTS imagery &amp; orbital data layers
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                Base Planetary Mosaic
              </div>
              <div className="space-y-1.5">
                {(
                  [
                    {
                      id: 'viking',
                      title: 'Viking MDIM 2.1 Color',
                      meta: 'NASA/USGS · 232m Global Mosaic',
                    },
                    {
                      id: 'mola',
                      title: 'MOLA Shaded Elevation',
                      meta: 'Mars Global Surveyor · 463m Hypsometry',
                    },
                    {
                      id: 'themis',
                      title: 'THEMIS Day Infrared',
                      meta: 'Mars Odyssey · 100m Thermal Mosaic',
                    },
                  ] as const
                ).map((item) => {
                  const active = activeLayer === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onLayerChange(item.id)}
                      className={`w-full text-left rounded-md border p-2.5 transition-colors ${
                        active
                          ? 'border-[#E05A2B]/80 bg-[#E05A2B]/10'
                          : 'border-slate-200 dark:border-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.meta}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                Scientific Overlays
              </div>

              {(
                [
                  {
                    key: 'spacecraftPins',
                    label: 'Landers, Rovers & Sites',
                    desc: '14 verified IAU sites & active surface missions',
                  },
                  {
                    key: 'graticule',
                    label: 'Areographic Grid',
                    desc: '30° meridian & parallel reference mesh',
                  },
                  {
                    key: 'iceZones',
                    label: 'Subsurface Water-Ice Belts',
                    desc: 'SHARAD radar & Odyssey GRS shallow ice zones',
                  },
                  {
                    key: 'dustCorridors',
                    label: 'Seasonal Dust Storm Tracks',
                    desc: 'Hellas & Acidalia dust nucleation corridors',
                  },
                ] as const
              ).map((ov) => (
                <label
                  key={ov.key}
                  className="flex items-start justify-between gap-2.5 cursor-pointer rounded-md border border-slate-200 dark:border-slate-800/80 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {ov.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {ov.desc}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={overlays[ov.key]}
                    onChange={() => onToggleOverlay(ov.key)}
                    className="mt-0.5 h-3.5 w-3.5 accent-sky-500 rounded"
                  />
                </label>
              ))}
            </div>

            <div className="space-y-3.5 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    NASA WMTS Opacity
                  </span>
                  <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                    {Math.round(imageryOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={imageryOpacity}
                  onChange={(e) => onImageryOpacityChange(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Solar Illumination Longitude
                  </span>
                  <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                    {sunAngleDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={sunAngleDeg}
                  onChange={(e) => onSunAngleChange(Number(e.target.value))}
                  className="w-full accent-[#E05A2B]"
                />
              </div>
            </div>
          </div>
        )}

        {activeSection !== 'explore' && activeSection !== 'layers' && children}
      </div>
    </aside>
  );
};
