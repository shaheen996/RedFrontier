export type WorkspaceMode = 'explore' | 'science' | 'planner' | 'data';

export type SidebarSection = 'explore' | 'layers' | 'science' | 'planner' | 'data';

export type ImageryLayerId = 'viking' | 'mola' | 'themis';

export type GlobeViewMode = '3d' | '2d' | 'columbus';

export type SiteCategory = 'all' | 'rover' | 'volcanic' | 'canyon' | 'ice';

export interface MarsSite {
  id: string;
  name: string;
  region: string;
  category: Exclude<SiteCategory, 'all'>;
  lat: number;
  lon: number;
  elevationKm: number;
  slopeDeg: number;
  thermalInertia: number; // J m^-2 K^-1 s^-1/2 (tiu)
  epoch: 'Noachian' | 'Hesperian' | 'Amazonian';
  mineralogy: string;
  iceDepthStatus: string;
  missionHistory?: string;
  summary: string;
  keyScience: string[];
  landingRisk: 'Low' | 'Moderate' | 'High';
  dustTau: number;
}

export interface MapOverlayState {
  graticule: boolean;
  spacecraftPins: boolean;
  iceZones: boolean;
  dustCorridors: boolean;
}

export interface TraverseWaypoint {
  id: string;
  label: string;
  lat: number;
  lon: number;
  elevationKm: number;
  note?: string;
}

export interface PresetTraverse {
  id: string;
  name: string;
  region: string;
  objective: string;
  waypoints: Omit<TraverseWaypoint, 'id'>[];
}

export interface SelectedCoordinate {
  name: string;
  lat: number;
  lon: number;
  elevationKm: number;
  slopeDeg: number;
  thermalInertia?: number;
  epoch?: string;
  mineralogy?: string;
  site?: MarsSite;
}

export interface AIAnalysisResult {
  headline: string;
  geologicalContext: string;
  astrobiologyAndResources: string;
  engineeringAssessment: string;
  recommendedInstruments: string[];
  confidenceNote: string;
}

export interface NasaMediaItem {
  nasaId: string;
  title: string;
  description: string;
  dateCreated: string;
  center: string;
  thumbnailUrl: string;
}
