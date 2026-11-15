import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  Compass,
  Crosshair,
  Globe2,
  Grid,
  Map as MapIcon,
  Minus,
  Plus,
  RotateCw,
} from 'lucide-react';
import {
  DUST_STORM_CORRIDORS,
  MARS_RADII,
  MARS_SITES,
  SUBSURFACE_ICE_BELTS,
} from '../data/marsData';
import type {
  GlobeViewMode,
  ImageryLayerId,
  MapOverlayState,
  MarsSite,
  SelectedCoordinate,
  TraverseWaypoint,
} from '../types/mars';
import {
  estimateMarsElevationKm,
  estimateMarsSlopeDeg,
  getProceduralMarsTexture,
} from '../utils/marsGeo';

interface MarsGlobeProps {
  activeLayer: ImageryLayerId;
  onLayerChange: (layer: ImageryLayerId) => void;
  overlays: MapOverlayState;
  onToggleOverlay: (key: keyof MapOverlayState) => void;
  viewMode: GlobeViewMode;
  onViewModeChange: (mode: GlobeViewMode) => void;
  sunAngleDeg: number;
  imageryOpacity: number;
  selectedSiteId: string | null;
  selectedCoord: SelectedCoordinate;
  flyToTarget: { lat: number; lon: number; heightMeters?: number; key: number } | null;
  waypoints: TraverseWaypoint[];
  isPickingWaypoint: boolean;
  onSelectSite: (site: MarsSite) => void;
  onInspectCoordinate: (coord: SelectedCoordinate) => void;
  onAddWaypoint: (lat: number, lon: number, elevationKm: number) => void;
  isDark: boolean;
}

const MARS_ELLIPSOID = new Cesium.Ellipsoid(
  MARS_RADII.equatorialMeters,
  MARS_RADII.equatorialMeters,
  MARS_RADII.polarMeters
);

const DEFAULT_CAMERA_RANGE_M = 6350000;

function createMarkerSvg(color: string, isSelected: boolean, label?: string): string {
  const ring = isSelected
    ? `<circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2" />
       <circle cx="16" cy="16" r="10.5" fill="none" stroke="rgba(248,250,252,0.5)" stroke-width="0.9" />`
    : `<circle cx="16" cy="16" r="9" fill="none" stroke="rgba(248,250,252,0.35)" stroke-width="0.8" />`;
  const inner = label
    ? `<circle cx="16" cy="16" r="10" fill="#060A14" stroke="${color}" stroke-width="2" />
       <text x="16" y="19.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600" fill="#F8FAFC">${label}</text>`
    : `<circle cx="16" cy="16" r="5" fill="${color}" stroke="#060A14" stroke-width="1.8" />`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${ring}${inner}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const CATEGORY_COLORS: Record<MarsSite['category'], string> = {
  rover: '#E05A2B',
  volcanic: '#F59E0B',
  canyon: '#EF4444',
  ice: '#38BDF8',
};

export const MarsGlobe: React.FC<MarsGlobeProps> = ({
  activeLayer,
  onLayerChange,
  overlays,
  onToggleOverlay,
  viewMode,
  onViewModeChange,
  sunAngleDeg,
  imageryOpacity,
  selectedSiteId,
  selectedCoord,
  flyToTarget,
  waypoints,
  isPickingWaypoint,
  onSelectSite,
  onInspectCoordinate,
  onAddWaypoint,
  isDark,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const wmtsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const baseLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const siteEntitiesRef = useRef<Cesium.Entity[]>([]);
  const overlayEntitiesRef = useRef<Cesium.Entity[]>([]);
  const traverseEntitiesRef = useRef<Cesium.Entity[]>([]);
  const reticleEntityRef = useRef<Cesium.Entity | null>(null);

  const [autoSpin, setAutoSpin] = useState(false);
  const [cursorInfo, setCursorInfo] = useState<{
    lat: number;
    lon: number;
    elevKm: number;
    slopeDeg: number;
    rangeKm: number;
  }>({
    lat: 18.38,
    lon: 77.58,
    elevKm: -2.57,
    slopeDeg: 3.4,
    rangeKm: 6350,
  });

  const callbacksRef = useRef({
    isPickingWaypoint,
    onSelectSite,
    onInspectCoordinate,
    onAddWaypoint,
  });
  callbacksRef.current = {
    isPickingWaypoint,
    onSelectSite,
    onInspectCoordinate,
    onAddWaypoint,
  };

  // Initialize Cesium Viewer once
  useEffect(() => {
    if (!containerRef.current) return;

    const marsGlobe = new Cesium.Globe(MARS_ELLIPSOID);
    marsGlobe.enableLighting = true;
    marsGlobe.baseColor = Cesium.Color.fromCssColorString('#6D3B28');
    marsGlobe.atmosphereBrightnessShift = 0.06;

    const viewer = new Cesium.Viewer(containerRef.current, {
      globe: marsGlobe,
      mapProjection: new Cesium.GeographicProjection(MARS_ELLIPSOID),
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      timeline: false,
      animation: false,
      fullscreenButton: false,
      selectionIndicator: false,
      skyBox: false,
      skyAtmosphere: new Cesium.SkyAtmosphere(MARS_ELLIPSOID),
      creditContainer: document.createElement('div'),
    });

    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.hueShift = 0.04;
      viewer.scene.skyAtmosphere.saturationShift = 0.16;
      viewer.scene.skyAtmosphere.brightnessShift = -0.06;
    }

    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#040711');
    viewer.scene.moon = undefined as unknown as Cesium.Moon;
    if (viewer.scene.sun) {
      viewer.scene.sun.show = false;
    }

    // Prominent centered initial framing of Mars
    viewer.camera.setView({
      destination: MARS_ELLIPSOID.cartographicToCartesian(
        Cesium.Cartographic.fromDegrees(48, 12, DEFAULT_CAMERA_RANGE_M)
      ),
    });

    // Pointer hover & click picking
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, MARS_ELLIPSOID);
      const camCarto = MARS_ELLIPSOID.cartesianToCartographic(viewer.camera.positionWC);
      const rangeKm = camCarto ? Math.max(1, camCarto.height / 1000) : 6350;

      if (cartesian) {
        const carto = MARS_ELLIPSOID.cartesianToCartographic(cartesian);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        setCursorInfo({
          lat: Number(lat.toFixed(2)),
          lon: Number(lon.toFixed(2)),
          elevKm: estimateMarsElevationKm(lat, lon),
          slopeDeg: estimateMarsSlopeDeg(lat, lon),
          rangeKm: Math.round(rangeKm),
        });
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && picked.id._marsSite) {
        const site = picked.id._marsSite as MarsSite;
        if (!callbacksRef.current.isPickingWaypoint) {
          callbacksRef.current.onSelectSite(site);
          return;
        }
      }

      const cartesian = viewer.camera.pickEllipsoid(click.position, MARS_ELLIPSOID);
      if (!cartesian) return;

      const carto = MARS_ELLIPSOID.cartesianToCartographic(cartesian);
      const lat = Number(Cesium.Math.toDegrees(carto.latitude).toFixed(3));
      const lon = Number(Cesium.Math.toDegrees(carto.longitude).toFixed(3));
      const elevKm = estimateMarsElevationKm(lat, lon);
      const slopeDeg = estimateMarsSlopeDeg(lat, lon);

      if (callbacksRef.current.isPickingWaypoint) {
        callbacksRef.current.onAddWaypoint(lat, lon, elevKm);
      } else {
        callbacksRef.current.onInspectCoordinate({
          name: `Surface Coordinate (${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'})`,
          lat,
          lon,
          elevationKm: elevKm,
          slopeDeg,
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Update deep-space background color cleanly with theme
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(
      isDark ? '#040711' : '#0B1324'
    );
  }, [isDark]);

  // Update sun illumination angle dynamically
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const rad = Cesium.Math.toRadians(sunAngleDeg);
    viewer.scene.light = new Cesium.DirectionalLight({
      direction: new Cesium.Cartesian3(Math.cos(rad), Math.sin(rad), -0.2),
      intensity: 2.15,
    });
  }, [sunAngleDeg]);

  // Auto-spin ticker
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !autoSpin) return;
    const listener = () => {
      if (viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
        viewer.camera.rotateRight(0.0012);
      }
    };
    viewer.clock.onTick.addEventListener(listener);
    return () => {
      viewer.clock.onTick.removeEventListener(listener);
    };
  }, [autoSpin]);

  // Switch imagery layers (procedural equirectangular base + NASA Mars Trek WMTS overlay)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cancelled = false;

    const layers = viewer.imageryLayers;
    layers.removeAll(true);

    const textureUrl = getProceduralMarsTexture(activeLayer);
    Cesium.SingleTileImageryProvider.fromUrl(textureUrl, {
      rectangle: Cesium.Rectangle.MAX_VALUE,
      ellipsoid: MARS_ELLIPSOID,
    })
      .then((baseProvider) => {
        if (cancelled || !viewerRef.current) return;
        const baseLayer = layers.addImageryProvider(baseProvider, 0);
        baseLayer.brightness = 1.03;
        baseLayerRef.current = baseLayer;

        const wmtsProvider = new Cesium.UrlTemplateImageryProvider({
          url: `/api/mars/tile/${activeLayer}/{z}/{y}/{x}`,
          tilingScheme: new Cesium.GeographicTilingScheme({
            ellipsoid: MARS_ELLIPSOID,
            numberOfLevelZeroTilesX: 2,
            numberOfLevelZeroTilesY: 1,
          }),
          maximumLevel: 7,
          credit: 'NASA Mars Trek / USGS Astrogeology',
        });

        const wmtsLayer = layers.addImageryProvider(wmtsProvider, 1);
        wmtsLayer.alpha = imageryOpacity;
        wmtsLayerRef.current = wmtsLayer;
      })
      .catch(() => {
        // Procedural base already active
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayer]);

  // Adjust NASA tile opacity dynamically
  useEffect(() => {
    if (wmtsLayerRef.current) {
      wmtsLayerRef.current.alpha = imageryOpacity;
    }
  }, [imageryOpacity]);

  // Switch 3D / 2D projection
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (viewMode === '3d') viewer.scene.morphTo3D(0.6);
    else if (viewMode === '2d') viewer.scene.morphTo2D(0.6);
    else viewer.scene.morphToColumbusView(0.6);
  }, [viewMode]);

  // Fly camera when requested
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToTarget) return;
    setAutoSpin(false);
    const dest = MARS_ELLIPSOID.cartographicToCartesian(
      Cesium.Cartographic.fromDegrees(
        flyToTarget.lon,
        flyToTarget.lat,
        flyToTarget.heightMeters ?? 1550000
      )
    );
    viewer.camera.flyTo({
      destination: dest,
      duration: 1.2,
    });
  }, [flyToTarget]);

  // Render Mars Sites & Spacecraft Pins
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    siteEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    siteEntitiesRef.current = [];

    if (!overlays.spacecraftPins) return;

    MARS_SITES.forEach((site) => {
      const isSelected = site.id === selectedSiteId;
      const color = CATEGORY_COLORS[site.category];
      const entity = viewer.entities.add({
        position: MARS_ELLIPSOID.cartographicToCartesian(
          Cesium.Cartographic.fromDegrees(site.lon, site.lat, 8000)
        ),
        billboard: {
          image: createMarkerSvg(color, isSelected),
          width: isSelected ? 32 : 22,
          height: isSelected ? 32 : 22,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: site.name.split(' (')[0],
          font: isSelected
            ? '600 12px "IBM Plex Sans", sans-serif'
            : '500 11px "IBM Plex Sans", sans-serif',
          fillColor: Cesium.Color.fromCssColorString(isSelected ? '#FFFFFF' : '#E2E8F0'),
          outlineColor: Cesium.Color.fromCssColorString('#060A14'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -21),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            isSelected ? 2.2e7 : 8.2e6
          ),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      (entity as any)._marsSite = site;
      siteEntitiesRef.current.push(entity);
    });
  }, [overlays.spacecraftPins, selectedSiteId]);

  // Render Areographic Graticule, Ice Zones & Dust Corridors
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    overlayEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    overlayEntitiesRef.current = [];

    if (overlays.graticule) {
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts: Cesium.Cartesian3[] = [];
        for (let lon = -180; lon <= 180; lon += 4) {
          pts.push(
            MARS_ELLIPSOID.cartographicToCartesian(
              Cesium.Cartographic.fromDegrees(lon, lat, 3000)
            )
          );
        }
        overlayEntitiesRef.current.push(
          viewer.entities.add({
            polyline: {
              positions: pts,
              width: lat === 0 ? 1.5 : 0.75,
              material: Cesium.Color.fromCssColorString(
                lat === 0 ? 'rgba(224, 90, 43, 0.5)' : 'rgba(148, 163, 184, 0.22)'
              ),
            },
          })
        );
      }

      for (let lon = -180; lon < 180; lon += 30) {
        const pts: Cesium.Cartesian3[] = [];
        for (let lat = -85; lat <= 85; lat += 4) {
          pts.push(
            MARS_ELLIPSOID.cartographicToCartesian(
              Cesium.Cartographic.fromDegrees(lon, lat, 3000)
            )
          );
        }
        overlayEntitiesRef.current.push(
          viewer.entities.add({
            polyline: {
              positions: pts,
              width: lon === 0 ? 1.5 : 0.75,
              material: Cesium.Color.fromCssColorString(
                lon === 0 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(148, 163, 184, 0.2)'
              ),
            },
          })
        );
      }
    }

    if (overlays.iceZones) {
      SUBSURFACE_ICE_BELTS.forEach((zone) => {
        const flat = zone.coords.flat();
        overlayEntitiesRef.current.push(
          viewer.entities.add({
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flat, MARS_ELLIPSOID),
              material: Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.16)'),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.72)'),
              outlineWidth: 1.5,
              height: 4000,
            },
          })
        );
      });
    }

    if (overlays.dustCorridors) {
      DUST_STORM_CORRIDORS.forEach((zone) => {
        const flat = zone.coords.flat();
        overlayEntitiesRef.current.push(
          viewer.entities.add({
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flat, MARS_ELLIPSOID),
              material: Cesium.Color.fromCssColorString('rgba(245, 158, 11, 0.14)'),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('rgba(245, 158, 11, 0.7)'),
              outlineWidth: 1.5,
              height: 4500,
            },
          })
        );
      });
    }
  }, [overlays.graticule, overlays.iceZones, overlays.dustCorridors]);

  // Render Rover Traverse Path & Waypoints
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    traverseEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    traverseEntitiesRef.current = [];

    if (waypoints.length === 0) return;

    const positions = waypoints.map((wp) =>
      MARS_ELLIPSOID.cartographicToCartesian(
        Cesium.Cartographic.fromDegrees(wp.lon, wp.lat, 12000)
      )
    );

    if (waypoints.length >= 2) {
      traverseEntitiesRef.current.push(
        viewer.entities.add({
          polyline: {
            positions,
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString('#38BDF8'),
              dashLength: 14,
            }),
          },
        })
      );
    }

    waypoints.forEach((wp, idx) => {
      traverseEntitiesRef.current.push(
        viewer.entities.add({
          position: positions[idx],
          billboard: {
            image: createMarkerSvg('#38BDF8', true, String(idx + 1)),
            width: 26,
            height: 26,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `WP-${String(idx + 1).padStart(2, '0')}`,
            font: '600 10px "IBM Plex Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#7DD3FC'),
            outlineColor: Cesium.Color.fromCssColorString('#060A14'),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
      );
    });
  }, [waypoints]);

  // Render Target Reticle for custom clicked coordinate
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (reticleEntityRef.current) {
      viewer.entities.remove(reticleEntityRef.current);
      reticleEntityRef.current = null;
    }
    if (!selectedCoord.site) {
      reticleEntityRef.current = viewer.entities.add({
        position: MARS_ELLIPSOID.cartographicToCartesian(
          Cesium.Cartographic.fromDegrees(selectedCoord.lon, selectedCoord.lat, 10000)
        ),
        billboard: {
          image: createMarkerSvg('#E05A2B', true),
          width: 28,
          height: 28,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  }, [selectedCoord]);

  const handleZoom = (factor: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const carto = MARS_ELLIPSOID.cartesianToCartographic(viewer.camera.positionWC);
    const currentHeight = carto ? carto.height : DEFAULT_CAMERA_RANGE_M;
    const delta = currentHeight * factor;
    if (factor < 0) viewer.camera.zoomIn(Math.abs(delta));
    else viewer.camera.zoomOut(Math.abs(delta));
  };

  const handleResetView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setAutoSpin(false);
    viewer.camera.flyTo({
      destination: MARS_ELLIPSOID.cartographicToCartesian(
        Cesium.Cartographic.fromDegrees(48, 12, DEFAULT_CAMERA_RANGE_M)
      ),
      duration: 1.0,
    });
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#040711] ${
        isPickingWaypoint ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Refined Floating Top Toolbar */}
      <div className="pointer-events-none absolute top-3 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2">
        {/* Coordinate & Telemetry Readout */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-700/60 bg-[#070C17]/82 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <Crosshair className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono tabular-nums text-slate-100">
              {Math.abs(cursorInfo.lat).toFixed(2)}°{cursorInfo.lat >= 0 ? 'N' : 'S'}{' '}
              {Math.abs(cursorInfo.lon).toFixed(2)}°{cursorInfo.lon >= 0 ? 'E' : 'W'}
            </span>
          </div>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <div className="font-mono tabular-nums text-sky-300">
            {cursorInfo.elevKm > 0 ? '+' : ''}
            {cursorInfo.elevKm.toFixed(2)} km
          </div>
          <span className="hidden sm:inline text-slate-600" aria-hidden="true">
            ·
          </span>
          <div className="hidden sm:block font-mono tabular-nums text-slate-300">
            Slope {cursorInfo.slopeDeg.toFixed(1)}°
          </div>
          <span className="hidden xl:inline text-slate-600" aria-hidden="true">
            ·
          </span>
          <div className="hidden xl:block font-mono tabular-nums text-slate-400">
            Alt {cursorInfo.rangeKm.toLocaleString()} km
          </div>
        </div>

        {/* Imagery & Projection Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-[#070C17]/82 p-1 backdrop-blur-md">
            {(
              [
                { id: 'viking', label: 'Viking Color' },
                { id: 'mola', label: 'MOLA Relief' },
                { id: 'themis', label: 'THEMIS IR' },
              ] as const
            ).map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => onLayerChange(layer.id)}
                className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeLayer === layer.id
                    ? 'bg-[#E05A2B] text-white'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                {layer.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-[#070C17]/82 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => onViewModeChange('3d')}
              title="3D Mars Globe"
              className={`flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === '3d'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe2 className="h-3.5 w-3.5" />
              3D
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('2d')}
              title="2D Equirectangular Map"
              className={`flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === '2d'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              2D
            </button>
          </div>
        </div>
      </div>

      {/* Waypoint Pick Banner */}
      {isPickingWaypoint && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-10 rounded-lg border border-sky-400/50 bg-[#070C17]/90 px-3.5 py-1.5 text-xs font-medium text-sky-300 backdrop-blur-md">
          Click anywhere on Mars to place traverse waypoint WP-{String(waypoints.length + 1).padStart(2, '0')}
        </div>
      )}

      {/* Bottom-Left Camera Navigation Controls */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-slate-700/60 bg-[#070C17]/82 p-1 backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleZoom(-0.35)}
          title="Zoom In"
          aria-label="Zoom In"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(0.45)}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Reset Global View"
          aria-label="Reset Global View"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
        >
          <Compass className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setAutoSpin((v) => !v)}
          title="Toggle Globe Rotation"
          aria-label="Toggle Globe Rotation"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            autoSpin
              ? 'bg-[#E05A2B] text-white'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggleOverlay('graticule')}
          title="Toggle Areographic Grid"
          aria-label="Toggle Areographic Grid"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            overlays.graticule
              ? 'bg-sky-500/20 text-sky-300'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Grid className="h-4 w-4" />
        </button>
      </div>

      {/* Sophisticated Centered Elevation & Dataset Legend Below the Globe */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 hidden md:flex items-center gap-3 rounded-lg border border-slate-700/60 bg-[#070C17]/82 px-3.5 py-1.5 text-[11px] text-slate-300 backdrop-blur-md whitespace-nowrap">
        <span className="font-medium text-sky-300">
          {activeLayer === 'viking'
            ? 'Viking MDIM 2.1'
            : activeLayer === 'mola'
            ? 'MOLA Hypsometry'
            : 'THEMIS Day IR'}
        </span>
        <span className="text-slate-600" aria-hidden="true">
          ·
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-slate-400">-8 km</span>
          <span
            className="h-2 w-28 rounded-sm border border-slate-700/70"
            style={{
              background:
                activeLayer === 'themis'
                  ? 'linear-gradient(90deg, #27272a 0%, #71717a 50%, #f4f4f5 100%)'
                  : 'linear-gradient(90deg, #22308a 0%, #3a71c1 25%, #80cb6c 50%, #e99e28 75%, #e5e5e5 100%)',
            }}
          />
          <span className="font-mono tabular-nums text-slate-400">+21 km</span>
        </div>
        <span className="text-slate-600 hidden xl:inline" aria-hidden="true">
          ·
        </span>
        <span className="text-slate-400 hidden xl:inline">IAU Mars 2015</span>
      </div>
    </div>
  );
};
