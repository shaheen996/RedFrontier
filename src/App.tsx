import { useCallback, useEffect, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { DataExplorerPanel } from './components/DataExplorerPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { LeftSidebar } from './components/LeftSidebar';
import { MarsGlobe } from './components/MarsGlobe';
import { MissionPlannerPanel } from './components/MissionPlannerPanel';
import { ScienceTargetsPanel } from './components/ScienceTargetsPanel';
import { TopNav } from './components/TopNav';
import { MARS_SITES, PRESET_TRAVERSES } from './data/marsData';
import type {
  AIAnalysisResult,
  GlobeViewMode,
  ImageryLayerId,
  MapOverlayState,
  MarsSite,
  PresetTraverse,
  SelectedCoordinate,
  SidebarSection,
  TraverseWaypoint,
  WorkspaceMode,
} from './types/mars';

const INITIAL_SITE = MARS_SITES[0]; // Jezero Crater

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('explore');
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>('explore');

  const [activeLayer, setActiveLayer] = useState<ImageryLayerId>('viking');
  const [viewMode, setViewMode] = useState<GlobeViewMode>('3d');
  const [imageryOpacity, setImageryOpacity] = useState(0.92);
  const [sunAngleDeg, setSunAngleDeg] = useState(35);

  const [overlays, setOverlays] = useState<MapOverlayState>({
    graticule: true,
    spacecraftPins: true,
    iceZones: false,
    dustCorridors: false,
  });

  const [selectedCoord, setSelectedCoord] = useState<SelectedCoordinate>({
    name: INITIAL_SITE.name,
    lat: INITIAL_SITE.lat,
    lon: INITIAL_SITE.lon,
    elevationKm: INITIAL_SITE.elevationKm,
    slopeDeg: INITIAL_SITE.slopeDeg,
    thermalInertia: INITIAL_SITE.thermalInertia,
    epoch: INITIAL_SITE.epoch,
    mineralogy: INITIAL_SITE.mineralogy,
    site: INITIAL_SITE,
  });

  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number;
    lon: number;
    heightMeters?: number;
    key: number;
  } | null>(null);

  // Mission Planner state
  const [waypoints, setWaypoints] = useState<TraverseWaypoint[]>(() =>
    PRESET_TRAVERSES[0].waypoints.map((wp, idx) => ({
      ...wp,
      id: `init-wp-${idx}`,
    }))
  );
  const [isPickingWaypoint, setIsPickingWaypoint] = useState(false);

  // AI Surface Analyst state
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Responsive panels
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);

  // Sync .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  const handleModeChange = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    setSidebarSection(mode);
    if (mode !== 'planner') {
      setIsPickingWaypoint(false);
    }
    setIsMobileSidebarOpen(true);
  };

  const handleSectionChange = (section: SidebarSection) => {
    setSidebarSection(section);
    if (section !== 'layers') {
      setWorkspaceMode(section);
    }
    if (section !== 'planner') {
      setIsPickingWaypoint(false);
    }
  };

  const handleToggleOverlay = (key: keyof MapOverlayState) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectSite = useCallback((site: MarsSite) => {
    setSelectedCoord({
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      elevationKm: site.elevationKm,
      slopeDeg: site.slopeDeg,
      thermalInertia: site.thermalInertia,
      epoch: site.epoch,
      mineralogy: site.mineralogy,
      site,
    });
    setFlyToTarget({
      lat: site.lat,
      lon: site.lon,
      heightMeters: 1650000,
      key: Date.now(),
    });
    setAnalysis(null);
    setAnalysisError(null);
  }, []);

  const handleInspectCoordinate = useCallback((coord: SelectedCoordinate) => {
    setSelectedCoord(coord);
    setAnalysis(null);
    setAnalysisError(null);
  }, []);

  const handleAddWaypoint = useCallback((lat: number, lon: number, elevationKm: number) => {
    setWaypoints((prev) => [
      ...prev,
      {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: `Target Point ${prev.length + 1}`,
        lat,
        lon,
        elevationKm,
      },
    ]);
  }, []);

  const handleLoadPreset = (preset: PresetTraverse) => {
    const loaded = preset.waypoints.map((wp, idx) => ({
      ...wp,
      id: `preset-${preset.id}-${idx}-${Date.now()}`,
    }));
    setWaypoints(loaded);
    setIsPickingWaypoint(false);
    if (loaded.length > 0) {
      setFlyToTarget({
        lat: loaded[0].lat,
        lon: loaded[0].lon,
        heightMeters: 650000,
        key: Date.now(),
      });
    }
  };

  const runGeminiAnalysis = async (
    target: SelectedCoordinate,
    question: string,
    mode: 'site' | 'mission' = 'site',
    totalDistanceKm?: number
  ) => {
    setAnalyzing(true);
    setAnalysisError(null);
    setIsInspectorCollapsed(false);
    setIsMobileInspectorOpen(true);

    try {
      const response = await fetch('/api/mars/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: target.name,
          lat: target.lat,
          lon: target.lon,
          elevationKm: target.elevationKm,
          epoch: target.epoch,
          mineralogy: target.mineralogy,
          question,
          mode,
          waypoints: mode === 'mission' ? waypoints : [],
          totalDistanceKm,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Analysis service unavailable');
      }
      setAnalysis(data as AIAnalysisResult);
    } catch (err: any) {
      setAnalysisError(err?.message || 'Failed to complete planetary analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeSite = (site: MarsSite, focusQuestion: string) => {
    const coord: SelectedCoordinate = {
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      elevationKm: site.elevationKm,
      slopeDeg: site.slopeDeg,
      thermalInertia: site.thermalInertia,
      epoch: site.epoch,
      mineralogy: site.mineralogy,
      site,
    };
    runGeminiAnalysis(coord, focusQuestion, 'site');
  };

  const handleRunMissionAudit = (
    totalDistanceKm: number,
    dustTau: number,
    roverSpeedMhr: number
  ) => {
    if (waypoints.length === 0) return;
    const first = waypoints[0];
    const missionCoord: SelectedCoordinate = {
      name: `Traverse Plan (${waypoints.length} Waypoints)`,
      lat: first.lat,
      lon: first.lon,
      elevationKm: first.elevationKm,
      slopeDeg: selectedCoord.slopeDeg,
    };
    setSelectedCoord(missionCoord);
    runGeminiAnalysis(
      missionCoord,
      `Audit this ${totalDistanceKm.toFixed(2)} km rover traverse under dust optical depth tau=${dustTau.toFixed(2)} and rover speed ${roverSpeedMhr} m/hr. Identify terrain trafficability risks, power/thermal constraints, and priority science stops.`,
      'mission',
      totalDistanceKm
    );
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F4F6F9] dark:bg-[#050811] text-slate-900 dark:text-slate-100">
      <TopNav
        activeMode={workspaceMode}
        onModeChange={handleModeChange}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenAIAnalyst={() =>
          runGeminiAnalysis(
            selectedCoord,
            'Provide a comprehensive geological, astrobiological, and landing engineering assessment for this Martian target.'
          )
        }
        isMobileMenuOpen={isMobileSidebarOpen}
        onToggleMobileMenu={() => setIsMobileSidebarOpen((v) => !v)}
      />

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Left Sidebar + Mobile Drawer */}
        <div
          className={`${
            isMobileSidebarOpen
              ? 'fixed inset-y-12 left-0 z-30 flex w-[290px] shadow-2xl'
              : 'hidden'
          } lg:static lg:z-auto lg:flex lg:shadow-none h-[calc(100vh-3rem)] lg:h-full`}
        >
          <LeftSidebar
            activeSection={sidebarSection}
            onSectionChange={handleSectionChange}
            selectedSiteId={selectedCoord.site?.id ?? null}
            onSelectSite={(site) => {
              handleSelectSite(site);
              setIsMobileSidebarOpen(false);
            }}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            overlays={overlays}
            onToggleOverlay={handleToggleOverlay}
            imageryOpacity={imageryOpacity}
            onImageryOpacityChange={setImageryOpacity}
            sunAngleDeg={sunAngleDeg}
            onSunAngleChange={setSunAngleDeg}
          >
            {sidebarSection === 'science' && (
              <ScienceTargetsPanel
                selectedSiteId={selectedCoord.site?.id ?? null}
                onSelectSite={(site) => {
                  handleSelectSite(site);
                  setIsMobileSidebarOpen(false);
                }}
                onAnalyzeSite={(site, q) => {
                  handleAnalyzeSite(site, q);
                  setIsMobileSidebarOpen(false);
                }}
              />
            )}

            {sidebarSection === 'planner' && (
              <MissionPlannerPanel
                waypoints={waypoints}
                isPickingWaypoint={isPickingWaypoint}
                onTogglePicking={() => setIsPickingWaypoint((v) => !v)}
                onLoadPreset={handleLoadPreset}
                onRemoveWaypoint={(id) =>
                  setWaypoints((prev) => prev.filter((w) => w.id !== id))
                }
                onClearWaypoints={() => {
                  setWaypoints([]);
                  setIsPickingWaypoint(false);
                }}
                onFlyToWaypoint={(wp) =>
                  setFlyToTarget({
                    lat: wp.lat,
                    lon: wp.lon,
                    heightMeters: 420000,
                    key: Date.now(),
                  })
                }
                onRunAIAudit={handleRunMissionAudit}
              />
            )}

            {sidebarSection === 'data' && <DataExplorerPanel />}
          </LeftSidebar>
        </div>

        {/* Central 3D CesiumJS Mars Globe */}
        <main className="relative flex-1 min-w-0 h-full">
          <MarsGlobe
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            overlays={overlays}
            onToggleOverlay={handleToggleOverlay}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sunAngleDeg={sunAngleDeg}
            imageryOpacity={imageryOpacity}
            selectedSiteId={selectedCoord.site?.id ?? null}
            selectedCoord={selectedCoord}
            flyToTarget={flyToTarget}
            waypoints={waypoints}
            isPickingWaypoint={isPickingWaypoint}
            onSelectSite={handleSelectSite}
            onInspectCoordinate={handleInspectCoordinate}
            onAddWaypoint={handleAddWaypoint}
            isDark={isDark}
          />

          {/* Mobile Quick Floating Inspector Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileInspectorOpen(true)}
            className="lg:hidden absolute bottom-14 right-3 z-10 flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-[#070C17]/90 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur-md"
          >
            <Layers className="h-3.5 w-3.5 text-[#E05A2B]" />
            Intelligence
          </button>
        </main>

        {/* Desktop Right Inspector Panel */}
        <div className="hidden lg:flex h-full">
          <InspectorPanel
            selectedCoord={selectedCoord}
            analysis={analysis}
            analyzing={analyzing}
            analysisError={analysisError}
            onRunAnalysis={(q) => runGeminiAnalysis(selectedCoord, q, 'site')}
            isCollapsed={isInspectorCollapsed}
            onToggleCollapse={() => setIsInspectorCollapsed((v) => !v)}
          />
        </div>

        {/* Mobile Slide-Over Inspector */}
        {isMobileInspectorOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex justify-end bg-black/60">
            <div className="relative flex h-full w-full max-w-sm flex-col bg-white dark:bg-[#090F1C]">
              <button
                type="button"
                onClick={() => setIsMobileInspectorOpen(false)}
                aria-label="Close site inspector"
                className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
              <InspectorPanel
                selectedCoord={selectedCoord}
                analysis={analysis}
                analyzing={analyzing}
                analysisError={analysisError}
                onRunAnalysis={(q) => runGeminiAnalysis(selectedCoord, q, 'site')}
                isCollapsed={false}
                onToggleCollapse={() => setIsMobileInspectorOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
