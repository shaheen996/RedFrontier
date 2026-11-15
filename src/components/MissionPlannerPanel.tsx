import React, { useMemo, useState } from 'react';
import {
  Crosshair,
  Download,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { PRESET_TRAVERSES } from '../data/marsData';
import type { PresetTraverse, TraverseWaypoint } from '../types/mars';
import { marsGeodesicDistanceKm } from '../utils/marsGeo';

interface MissionPlannerPanelProps {
  waypoints: TraverseWaypoint[];
  isPickingWaypoint: boolean;
  onTogglePicking: () => void;
  onLoadPreset: (preset: PresetTraverse) => void;
  onRemoveWaypoint: (id: string) => void;
  onClearWaypoints: () => void;
  onFlyToWaypoint: (wp: TraverseWaypoint) => void;
  onRunAIAudit: (totalDistanceKm: number, dustTau: number, roverSpeedMhr: number) => void;
}

export const MissionPlannerPanel: React.FC<MissionPlannerPanelProps> = ({
  waypoints,
  isPickingWaypoint,
  onTogglePicking,
  onLoadPreset,
  onRemoveWaypoint,
  onClearWaypoints,
  onFlyToWaypoint,
  onRunAIAudit,
}) => {
  const [roverSpeedMhr, setRoverSpeedMhr] = useState(85);
  const [dustTau, setDustTau] = useState(0.42);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const metrics = useMemo(() => {
    let totalKm = 0;
    let climbMeters = 0;
    let descentMeters = 0;
    const cumulativeKm: number[] = [0];

    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const seg = marsGeodesicDistanceKm(prev.lat, prev.lon, curr.lat, curr.lon);
      totalKm += seg;
      cumulativeKm.push(totalKm);
      const dElevM = (curr.elevationKm - prev.elevationKm) * 1000;
      if (dElevM > 0) climbMeters += dElevM;
      else descentMeters += Math.abs(dElevM);
    }

    // 4.5 active driving hours per Martian sol
    const driveHours = (totalKm * 1000) / Math.max(10, roverSpeedMhr);
    const estSols = Math.ceil(driveHours / 4.5);

    // Solar yield approximation scaled by mean latitude & optical depth tau
    const meanLat =
      waypoints.length > 0
        ? waypoints.reduce((acc, w) => acc + Math.abs(w.lat), 0) / waypoints.length
        : 18;
    const solarYieldKwh = Number(
      (3.4 * Math.cos((meanLat * Math.PI) / 180) * Math.exp(-0.55 * dustTau)).toFixed(2)
    );

    return {
      totalKm,
      climbMeters: Math.round(climbMeters),
      descentMeters: Math.round(descentMeters),
      estSols,
      solarYieldKwh,
      cumulativeKm,
    };
  }, [waypoints, roverSpeedMhr, dustTau]);

  const elevationChart = useMemo(() => {
    if (waypoints.length < 2) return null;
    const w = 260;
    const h = 76;
    const padX = 8;
    const padY = 10;
    const elevs = waypoints.map((wp) => wp.elevationKm);
    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);
    const spanE = Math.max(0.1, maxE - minE);
    const maxDist = Math.max(0.1, metrics.totalKm);

    const points = waypoints.map((wp, idx) => {
      const x = padX + (metrics.cumulativeKm[idx] / maxDist) * (w - padX * 2);
      const y = h - padY - ((wp.elevationKm - minE) / spanE) * (h - padY * 2);
      return { x, y, wp, dist: metrics.cumulativeKm[idx] };
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${h - padY} L ${points[0].x.toFixed(1)} ${h - padY} Z`;

    return { w, h, points, pathD, areaD, minE, maxE };
  }, [waypoints, metrics]);

  const handleExportPlan = () => {
    const payload = {
      platform: 'Martian Map Mission Planner',
      generatedAt: new Date().toISOString(),
      parameters: { roverSpeedMhr, dustOpticalDepthTau: dustTau },
      summary: {
        waypointCount: waypoints.length,
        totalDistanceKm: Number(metrics.totalKm.toFixed(3)),
        elevationGainM: metrics.climbMeters,
        elevationLossM: metrics.descentMeters,
        estimatedTraverseSols: metrics.estSols,
        solarYieldKwhPerSol: metrics.solarYieldKwh,
      },
      waypoints,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `martian-traverse-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="border-b border-slate-200 dark:border-slate-800/80 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Mission Planner
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Plot 3D rover traverses &amp; assess EDL feasibility
            </p>
          </div>
          {waypoints.length > 0 && (
            <button
              type="button"
              onClick={onClearWaypoints}
              title="Clear traverse"
              className="text-xs text-slate-500 hover:text-rose-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onTogglePicking}
          className={`w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            isPickingWaypoint
              ? 'bg-cyan-500 text-slate-950'
              : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060A14] text-slate-800 dark:text-slate-100 hover:border-[#E05A2B]'
          }`}
        >
          {isPickingWaypoint ? (
            <>
              <Crosshair className="h-3.5 w-3.5" />
              Picking Active — Click Mars Globe
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Pick Waypoints on Globe
            </>
          )}
        </button>

        {/* Preset Traverses */}
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Reference Mission Templates
          </div>
          <div className="flex flex-col gap-1">
            {PRESET_TRAVERSES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onLoadPreset(preset)}
                className="text-left rounded border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs hover:border-[#E05A2B]/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {preset.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {preset.region} · {preset.waypoints.length} waypoints
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Traverse Engineering Metrics + Profile */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Traverse Dist
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
              {metrics.totalKm.toFixed(2)} <span className="text-[10px] text-slate-400">km</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Est. Duration
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
              {metrics.estSols} <span className="text-[10px] text-slate-400">sols</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Elev Gain / Loss
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-slate-100">
              +{metrics.climbMeters}m / -{metrics.descentMeters}m
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Solar Yield
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-slate-100">
              {metrics.solarYieldKwh} kWh/sol
            </div>
          </div>
        </div>

        {/* Elevation SVG Profile */}
        {elevationChart && (
          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060A14] p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Topographic Profile
              </span>
              <span className="font-mono tabular-nums text-[10px] text-slate-500">
                {hoverIdx !== null && elevationChart.points[hoverIdx]
                  ? `WP-${hoverIdx + 1}: ${elevationChart.points[hoverIdx].wp.elevationKm.toFixed(2)} km`
                  : `${elevationChart.minE.toFixed(1)} to ${elevationChart.maxE.toFixed(1)} km`}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${elevationChart.w} ${elevationChart.h}`}
              className="w-full h-19 overflow-visible"
            >
              <path d={elevationChart.areaD} fill="rgba(6, 182, 212, 0.14)" />
              <path
                d={elevationChart.pathD}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="1.75"
              />
              {elevationChart.points.map((pt, i) => (
                <circle
                  key={pt.wp.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoverIdx === i ? 4 : 2.8}
                  fill="#E05A2B"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  onClick={() => onFlyToWaypoint(pt.wp)}
                />
              ))}
            </svg>
          </div>
        )}

        {/* Rover & Atmospheric Parameters */}
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-600 dark:text-slate-400">Rover Mobility Speed</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                {roverSpeedMhr} m/hr
              </span>
            </div>
            <input
              type="range"
              min={25}
              max={200}
              step={5}
              value={roverSpeedMhr}
              onChange={(e) => setRoverSpeedMhr(Number(e.target.value))}
              className="w-full accent-[#E05A2B]"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-600 dark:text-slate-400">Dust Optical Depth (τ)</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                {dustTau.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.15}
              max={1.8}
              step={0.05}
              value={dustTau}
              onChange={(e) => setDustTau(Number(e.target.value))}
              className="w-full accent-[#E05A2B]"
            />
          </div>
        </div>

        {/* Waypoint List */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Active Waypoints ({waypoints.length})
          </div>
          {waypoints.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-xs text-slate-500">
              Load a template above or pick waypoints directly on Mars.
            </div>
          ) : (
            <div className="space-y-1.5">
              {waypoints.map((wp, idx) => (
                <div
                  key={wp.id}
                  className="flex items-center justify-between gap-2 rounded border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onFlyToWaypoint(wp)}
                    className="min-w-0 text-left flex-1"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      WP-{String(idx + 1).padStart(2, '0')} · {wp.label}
                    </div>
                    <div className="font-mono tabular-nums text-[10px] text-slate-500 dark:text-slate-400">
                      {wp.lat.toFixed(2)}°, {wp.lon.toFixed(2)}° · {wp.elevationKm.toFixed(2)} km
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveWaypoint(wp.id)}
                    aria-label={`Remove ${wp.label}`}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    {waypoints.length <= 2 ? <X className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mission Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={waypoints.length === 0}
            onClick={() => onRunAIAudit(metrics.totalKm, dustTau, roverSpeedMhr)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-[#E05A2B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C84B20] disabled:opacity-40 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            Run AI Mission Audit
          </button>

          <button
            type="button"
            disabled={waypoints.length === 0}
            onClick={handleExportPlan}
            title="Export Mission Plan JSON"
            className="flex items-center justify-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
};
