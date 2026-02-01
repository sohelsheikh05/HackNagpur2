// Types for the Ride Safety System

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  source: 'gps' | 'network' | 'wifi' | 'cell' | 'last_known';
}

export interface Route {
  id: string;
  waypoints: Location[];
  safetyScore: number;
  distance: number;
  estimatedDuration: number;
  highRiskZones: HighRiskZone[];
}

export interface HighRiskZone {
  id: string;
  center: Location;
  radius: number; // in meters
  riskLevel: number; // 0-1
  reason: string;
  reportCount: number;
  lastReported: number;
}

export interface RideSession {
  id: string;
  userId: string;
  source: Location;
  destination: Location;
  confirmedRoute: Route;
  alternativeRoutes: Route[];
  startTime: number;
  status: 'setup' | 'active' | 'completed' | 'emergency' | 'cancelled';
  locationHistory: Location[];
  threatHistory: ThreatAssessment[];
  emergencyContacts: EmergencyContact[];
  vehicleInfo?: VehicleInfo;
}

export interface VehicleInfo {
  licensePlate: string;
  driverName: string;
  vehicleModel: string;
  vehicleColor: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  notified: boolean;
  notifiedAt?: number;
}

export interface ThreatAssessment {
  timestamp: number;
  score: number;
  factors: ThreatFactors;
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  action: 'none' | 'log' | 'silent_dispatch' | 'emergency_escalation';
}

export interface ThreatFactors {
  routeDeviation: number;      // 40% weight
  suspiciousStops: number;     // 30% weight
  highRiskZone: number;        // 20% weight
  locationDisabled: number;    // 10% weight
}

export interface EvidencePacket {
  sessionId: string;
  timestamp: number;
  gpsHistory: Location[];
  deviationPoints: DeviationPoint[];
  threatAssessments: ThreatAssessment[];
  escalationReason: string;
  vehicleInfo?: VehicleInfo;
  emergencyContactsNotified: EmergencyContact[];
}

export interface DeviationPoint {
  location: Location;
  distanceFromRoute: number;
  duration: number;
  timestamp: number;
}

export interface CommunityReport {
  id: string;
  reporterId: string;
  reporterTrustScore: number;
  location: Location;
  type: 'unsafe_area' | 'safe_area' | 'incident' | 'suspicious_activity';
  description: string;
  timestamp: number;
  verificationCount: number;
  isVerified: boolean;
}

export interface SilentDispatch {
  id: string;
  sessionId: string;
  triggeredAt: number;
  threatScore: number;
  lastKnownLocation: Location;
  liveUpdates: Location[];
  emergencyServicesNotified: boolean;
  contactsNotified: string[];
  evidencePacket: EvidencePacket;
}

// Safe corridor around confirmed route (in meters)
export const SAFE_CORRIDOR_RADIUS = 100;

// Time thresholds (in milliseconds)
export const SUSPICIOUS_STOP_DURATION = 60000; // 1 minute
export const LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds
export const EMERGENCY_UPDATE_INTERVAL = 10000; // 10 seconds during emergency

// Threat score thresholds
export const THREAT_THRESHOLDS = {
  SOFT_ALERT: 0.4,
  SILENT_DISPATCH: 0.7,
  EMERGENCY_ESCALATION: 0.9,
} as const;

// Threat factor weights
export const THREAT_WEIGHTS = {
  ROUTE_DEVIATION: 0.4,
  SUSPICIOUS_STOPS: 0.3,
  HIGH_RISK_ZONE: 0.2,
  LOCATION_DISABLED: 0.1,
} as const;

// Community report settings
export const COMMUNITY_SETTINGS = {
  MAX_WEIGHT: 0.1, // 10% max influence
  MIN_TRUST_SCORE: 0.3,
  MIN_CONSENSUS: 3, // Minimum reporters needed
  DECAY_DAYS: 30, // Reports older than this have reduced weight
} as const;
