import React, { useState } from 'react';
import {
  ChevronRight,
  Compass,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react';
import type { AIAnalysisResult, SelectedCoordinate } from '../types/mars';
import { formatAreographicCoord } from '../utils/marsGeo';

interface InspectorPanelProps {
  selectedCoord: SelectedCoordinate;
  analysis: AIAnalysisResult | null;
  analyzing: boolean;
  analysisError: string | null;
  onRunAnalysis: (question: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const PRESET_PROMPTS = [
  {
    label: 'Decode Geology',
    question: 'Interpret the regional geomorphology, stratigraphic units, and mineral history.',
  },
  {
    label: 'Terrain Hazards',
    question: 'Evaluate EDL hazards, surface slopes, rock abundance, and dust storm risks.',
  },
  {
    label: 'ISRU Water Potential',
    question: 'Assess subsurface water-ice or hydrated mineral availability for human ISRU.',
  },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedCoord,
  analysis,
  analyzing,
  analysisError,
  onRunAnalysis,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [customQuery, setCustomQuery] = useState('');
  const site = selectedCoord.site;

  // Derived barometric scale-height estimate for arbitrary terrain points (Mars H ≈ 11.1 km)
  const estPressurePa = Math.round(610 * Math.exp(-selectedCoord.elevationKm / 11.1));

  // Real terrain suitability calibration percentages from measured site metrics
  const slopePct = Math.min(100, Math.round((selectedCoord.slopeDeg / 15) * 100));
  const inertiaPct = site ? Math.min(100, Math.round((site.thermalInertia / 500) * 100)) : null;
  const dustPct = site ? Math.min(100, Math.round((site.dustTau / 1.5) * 100)) : null;

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        title="Expand Scientific Intelligence Panel"
        className="hidden xl:flex flex-col items-center justify-center w-10 shrink-0 border-l border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090F1C] text-slate-500 hover:text-[#E05A2B] transition-colors"
      >
        <Sparkles className="h-4 w-4 mb-2 text-[#E05A2B]" />
        <span className="[writing-mode:vertical-rl] text-[11px] font-medium tracking-wider uppercase">
          Intelligence
        </span>
      </button>
    );
  }

  return (
    <aside className="flex h-full w-full lg:w-[308px] xl:w-[330px] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090F1C] overflow-hidden">
      {/* Location Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-sky-600 dark:text-sky-400">
            <Compass className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {formatAreographicCoord(selectedCoord.lat, selectedCoord.lon)}
            </span>
          </div>
          <h2 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {selectedCoord.name}
          </h2>
          {site ? (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {site.region} · {site.epoch}
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Custom Surface Inspection
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Collapse Intelligence Panel"
          className="hidden xl:flex h-7 w-7 items-center justify-center rounded border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Intelligence Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
        {/* Compact Scientific Measurement Cards (Cool Blue Accents) */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Elevation
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-sky-700 dark:text-sky-300">
              {selectedCoord.elevationKm > 0 ? '+' : ''}
              {selectedCoord.elevationKm.toFixed(2)}
              <span className="text-[10px] text-slate-400 ml-0.5">km</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Slope
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-sky-700 dark:text-sky-300">
              {selectedCoord.slopeDeg.toFixed(1)}
              <span className="text-[10px] text-slate-400 ml-0.5">°</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {site ? 'Inertia' : 'Est. P'}
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-sky-700 dark:text-sky-300">
              {site ? site.thermalInertia : estPressurePa}
              <span className="text-[10px] text-slate-400 ml-0.5">
                {site ? 'tiu' : 'Pa'}
              </span>
            </div>
          </div>
        </div>

        {/* Terrain & Suitability Indicators */}
        <div className="space-y-2 rounded-md border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#060A14] p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Terrain &amp; Surface Calibration
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {site ? 'MOLA · THEMIS' : 'MOLA Model Est.'}
            </span>
          </div>

          <div className="space-y-2 pt-0.5">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-500 dark:text-slate-400">Regional Slope vs 15° Limit</span>
                <span className="font-mono tabular-nums text-sky-600 dark:text-sky-300">
                  {selectedCoord.slopeDeg.toFixed(1)}°
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${slopePct}%` }}
                />
              </div>
            </div>

            {inertiaPct !== null && site && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Bedrock Thermal Inertia</span>
                  <span className="font-mono tabular-nums text-sky-600 dark:text-sky-300">
                    {site.thermalInertia} tiu
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${inertiaPct}%` }}
                  />
                </div>
              </div>
            )}

            {dustPct !== null && site && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Mean Dust Opacity (τ)</span>
                  <span className="font-mono tabular-nums text-[#E05A2B]">
                    τ {site.dustTau.toFixed(2)} · {site.landingRisk} Risk
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#E05A2B] transition-all duration-300"
                    style={{ width: `${dustPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Geological Classification, Mission & Scientific Significance */}
        {site ? (
          <div className="space-y-3 text-xs">
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {site.summary}
            </p>

            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Classification</span>
                <span className="text-right font-medium text-slate-800 dark:text-slate-200">
                  {site.epoch} · {site.category}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Composition</span>
                <span className="text-right font-medium text-slate-800 dark:text-slate-200">
                  {site.mineralogy}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Water / Ice</span>
                <span className="text-right text-sky-700 dark:text-sky-300">
                  {site.iceDepthStatus}
                </span>
              </div>
              {site.missionHistory && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">Mission</span>
                  <span className="text-right text-[#E05A2B] font-medium">
                    {site.missionHistory}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Scientific Significance
              </div>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                {site.keyScience.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#E05A2B]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Elevation and slope above are derived from the global MOLA spherical topographic model. Use the AI Surface Analyst below for region-specific geomorphology and landing safety insights.
          </div>
        )}

        {/* AI Surface Analyst Module */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#E05A2B]" />
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                AI Surface Analyst
              </h3>
            </div>
            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
              Gemini Analysis
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_PROMPTS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={analyzing}
                onClick={() => onRunAnalysis(preset.question)}
                className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-[#E05A2B]/80 hover:text-[#E05A2B] disabled:opacity-50 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customQuery.trim() && !analyzing) {
                onRunAnalysis(customQuery.trim());
              }
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Ask about geology, hazards, ISRU..."
              className="flex-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#E05A2B] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={analyzing || !customQuery.trim()}
              aria-label="Submit analysis query"
              className="flex items-center justify-center rounded-md bg-[#E05A2B] px-3 py-1.5 text-white hover:bg-[#C84B20] disabled:opacity-40 transition-colors"
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>

          {analyzing && (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] p-3 text-xs text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-[#E05A2B] shrink-0" />
              Analyzing orbital coordinates &amp; planetary geology...
            </div>
          )}

          {analysisError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500 dark:text-rose-400">
              {analysisError}
            </div>
          )}

          {analysis && !analyzing && (
            <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-[#060A14] p-3 text-xs">
              <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                {analysis.headline}
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Observations · Geological Context
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.geologicalContext}
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Estimates · Astrobiology &amp; ISRU
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.astrobiologyAndResources}
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#E05A2B]">
                  Recommendations · Engineering &amp; EDL
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.engineeringAssessment}
                </p>
                {analysis.recommendedInstruments?.length > 0 && (
                  <div className="pt-1 text-[11px] text-slate-800 dark:text-slate-200 font-medium">
                    Instruments: {analysis.recommendedInstruments.join(' · ')}
                  </div>
                )}
              </div>

              <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {analysis.confidenceNote}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
