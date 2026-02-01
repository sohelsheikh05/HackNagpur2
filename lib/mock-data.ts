// Mock data for the ride safety system
// In production, this would come from a database

import {
  HighRiskZone,
  CommunityReport,
  EmergencyContact,
  Location,
} from './safety-types';

// Mock high-risk zones in a sample city area
export const mockHighRiskZones: HighRiskZone[] = [
  {
    id: 'hrz-1',
    center: { lat: 28.6139, lng: 77.2090, timestamp: 0, source: 'network' },
    radius: 500,
    riskLevel: 0.7,
    reason: 'High incident reports',
    reportCount: 15,
    lastReported: Date.now() - 86400000,
  },
  {
    id: 'hrz-2',
    center: { lat: 28.6280, lng: 77.2200, timestamp: 0, source: 'network' },
    radius: 300,
    riskLevel: 0.5,
    reason: 'Poor lighting area',
    reportCount: 8,
    lastReported: Date.now() - 172800000,
  },
  {
    id: 'hrz-3',
    center: { lat: 28.6050, lng: 77.2300, timestamp: 0, source: 'network' },
    radius: 400,
    riskLevel: 0.8,
    reason: 'Isolated area with past incidents',
    reportCount: 22,
    lastReported: Date.now() - 43200000,
  },
  {
    id: 'hrz-4',
    center: { lat: 28.5900, lng: 77.2150, timestamp: 0, source: 'network' },
    radius: 350,
    riskLevel: 0.6,
    reason: 'Construction zone, low visibility',
    reportCount: 5,
    lastReported: Date.now() - 259200000,
  },
];

// Mock community reports
export const mockCommunityReports: CommunityReport[] = [
  {
    id: 'cr-1',
    reporterId: 'user-123',
    reporterTrustScore: 0.85,
    location: { lat: 28.6200, lng: 77.2150, timestamp: Date.now() - 3600000, source: 'gps' },
    type: 'unsafe_area',
    description: 'Dark alley, suspicious activity observed',
    timestamp: Date.now() - 3600000,
    verificationCount: 5,
    isVerified: true,
  },
  {
    id: 'cr-2',
    reporterId: 'user-456',
    reporterTrustScore: 0.92,
    location: { lat: 28.6100, lng: 77.2250, timestamp: Date.now() - 7200000, source: 'gps' },
    type: 'safe_area',
    description: 'Well-lit market area, many people around',
    timestamp: Date.now() - 7200000,
    verificationCount: 8,
    isVerified: true,
  },
  {
    id: 'cr-3',
    reporterId: 'user-789',
    reporterTrustScore: 0.75,
    location: { lat: 28.6250, lng: 77.2100, timestamp: Date.now() - 14400000, source: 'gps' },
    type: 'incident',
    description: 'Previous harassment incident reported',
    timestamp: Date.now() - 14400000,
    verificationCount: 3,
    isVerified: true,
  },
];

// Mock emergency contacts - UPDATE THESE WITH REAL EMAILS FOR TESTING
export const mockEmergencyContacts: EmergencyContact[] = [
  {
    id: 'ec-1',
    name: 'Emergency Contact 1',
    phone: '+91-9876543210',
    email: 'contact1@example.com', // Replace with real email
    relationship: 'Mother',
    notified: false,
  },
  {
    id: 'ec-2',
    name: 'Emergency Contact 2',
    phone: '+91-9876543211',
    email: 'contact2@example.com', // Replace with real email
    relationship: 'Friend',
    notified: false,
  },
  {
    id: 'ec-3',
    name: 'Emergency Contact 3',
    phone: '+91-9876543212',
    email: 'contact3@example.com', // Replace with real email
    relationship: 'Family',
    notified: false,
  },
];

// Generate mock route waypoints between two points
export function generateRouteWaypoints(
  source: Location,
  destination: Location,
  routeVariant: number = 0
): Location[] {
  const waypoints: Location[] = [source];
  
  const latDiff = destination.lat - source.lat;
  const lngDiff = destination.lng - source.lng;
  
  // Generate intermediate points based on route variant
  const numPoints = 8 + routeVariant * 2;
  
  for (let i = 1; i < numPoints; i++) {
    const progress = i / numPoints;
    
    // Add some variation for different routes
    const variation = routeVariant * 0.002 * Math.sin(progress * Math.PI);
    
    waypoints.push({
      lat: source.lat + latDiff * progress + variation * (routeVariant % 2 === 0 ? 1 : -1),
      lng: source.lng + lngDiff * progress + variation * (routeVariant % 2 === 0 ? -1 : 1),
      timestamp: source.timestamp + progress * 1800000, // 30 min total
      source: 'network',
    });
  }
  
  waypoints.push(destination);
  return waypoints;
}

// Sample locations for testing
export const sampleLocations = {
  home: { lat: 28.6292, lng: 77.2182, timestamp: Date.now(), source: 'gps' as const },
  office: { lat: 28.5921, lng: 77.2290, timestamp: Date.now(), source: 'gps' as const },
  mall: { lat: 28.6127, lng: 77.2273, timestamp: Date.now(), source: 'gps' as const },
  airport: { lat: 28.5562, lng: 77.1000, timestamp: Date.now(), source: 'gps' as const },
};
