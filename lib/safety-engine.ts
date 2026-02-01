// Core Safety Logic Engine
// This module handles threat detection, scoring, and escalation

import {
  Location,
  Route,
  ThreatAssessment,
  ThreatFactors,
  HighRiskZone,
  DeviationPoint,
  CommunityReport,
  SAFE_CORRIDOR_RADIUS,
  SUSPICIOUS_STOP_DURATION,
  THREAT_THRESHOLDS,
  THREAT_WEIGHTS,
  COMMUNITY_SETTINGS,
} from './safety-types';

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;
  const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the minimum distance from a point to a route
 */
export function distanceFromRoute(point: Location, route: Route): number {
  let minDistance = Infinity;

  for (const waypoint of route.waypoints) {
    const distance = calculateDistance(point, waypoint);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  // Also check distances to line segments between waypoints
  for (let i = 0; i < route.waypoints.length - 1; i++) {
    const segmentDistance = pointToLineSegmentDistance(
      point,
      route.waypoints[i],
      route.waypoints[i + 1]
    );
    if (segmentDistance < minDistance) {
      minDistance = segmentDistance;
    }
  }

  return minDistance;
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function pointToLineSegmentDistance(point: Location, lineStart: Location, lineEnd: Location): number {
  const A = point.lat - lineStart.lat;
  const B = point.lng - lineStart.lng;
  const C = lineEnd.lat - lineStart.lat;
  const D = lineEnd.lng - lineStart.lng;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let nearestLat: number;
  let nearestLng: number;

  if (param < 0) {
    nearestLat = lineStart.lat;
    nearestLng = lineStart.lng;
  } else if (param > 1) {
    nearestLat = lineEnd.lat;
    nearestLng = lineEnd.lng;
  } else {
    nearestLat = lineStart.lat + param * C;
    nearestLng = lineStart.lng + param * D;
  }

  return calculateDistance(point, { lat: nearestLat, lng: nearestLng, timestamp: 0, source: 'gps' });
}

/**
 * Calculate route deviation score (0-1)
 * Higher score = more deviation = more dangerous
 */
export function calculateRouteDeviationScore(
  currentLocation: Location,
  confirmedRoute: Route,
  deviationHistory: DeviationPoint[]
): number {
  const currentDistance = distanceFromRoute(currentLocation, confirmedRoute);
  
  // If within safe corridor, no deviation
  if (currentDistance <= SAFE_CORRIDOR_RADIUS) {
    return 0;
  }

  // Calculate deviation score based on distance and duration
  const distanceScore = Math.min(currentDistance / 1000, 1); // Normalize to 1km max
  
  // Check how long we've been deviated
  const recentDeviations = deviationHistory.filter(
    (d) => Date.now() - d.timestamp < 300000 // Last 5 minutes
  );
  
  const totalDeviationTime = recentDeviations.reduce((sum, d) => sum + d.duration, 0);
  const timeScore = Math.min(totalDeviationTime / 300000, 1); // Normalize to 5 min max
  
  return Math.min((distanceScore * 0.6 + timeScore * 0.4), 1);
}

/**
 * Calculate suspicious stops score (0-1)
 * Detects unexpected stops that could indicate danger
 */
export function calculateSuspiciousStopsScore(locationHistory: Location[]): number {
  if (locationHistory.length < 2) return 0;

  let suspiciousStopCount = 0;
  let currentStopDuration = 0;
  let stopStartIndex = -1;

  for (let i = 1; i < locationHistory.length; i++) {
    const distance = calculateDistance(locationHistory[i - 1], locationHistory[i]);
    const timeDiff = locationHistory[i].timestamp - locationHistory[i - 1].timestamp;
    
    // Speed in m/s (if less than 1 m/s for significant time, considered stopped)
    const speed = timeDiff > 0 ? distance / (timeDiff / 1000) : 0;

    if (speed < 1) {
      if (stopStartIndex === -1) {
        stopStartIndex = i - 1;
      }
      currentStopDuration += timeDiff;
    } else {
      if (currentStopDuration > SUSPICIOUS_STOP_DURATION) {
        suspiciousStopCount++;
      }
      currentStopDuration = 0;
      stopStartIndex = -1;
    }
  }

  // Check if currently in a suspicious stop
  if (currentStopDuration > SUSPICIOUS_STOP_DURATION) {
    suspiciousStopCount++;
  }

  // Normalize: 3+ stops = max score
  return Math.min(suspiciousStopCount / 3, 1);
}

/**
 * Calculate high-risk zone score (0-1)
 * Checks if current location is in a known dangerous area
 */
export function calculateHighRiskZoneScore(
  currentLocation: Location,
  highRiskZones: HighRiskZone[]
): number {
  let maxRisk = 0;

  for (const zone of highRiskZones) {
    const distance = calculateDistance(currentLocation, zone.center);
    
    if (distance <= zone.radius) {
      // Inside the zone - use full risk level
      maxRisk = Math.max(maxRisk, zone.riskLevel);
    } else if (distance <= zone.radius * 2) {
      // Near the zone - use reduced risk level
      const proximityFactor = 1 - (distance - zone.radius) / zone.radius;
      maxRisk = Math.max(maxRisk, zone.riskLevel * proximityFactor);
    }
  }

  return maxRisk;
}

/**
 * Calculate location disabled score (0-1)
 * Penalizes when location services are turned off
 */
export function calculateLocationDisabledScore(
  locationEnabled: boolean,
  lastKnownLocation: Location | null,
  timeSinceLastUpdate: number
): number {
  if (locationEnabled && timeSinceLastUpdate < 30000) {
    return 0;
  }

  // Location was recently disabled or updates stopped
  if (!locationEnabled) {
    return 1; // Maximum risk
  }

  // Location enabled but no updates - possible interference
  if (timeSinceLastUpdate > 60000) {
    return 0.8;
  }

  if (timeSinceLastUpdate > 30000) {
    return 0.4;
  }

  return 0;
}

/**
 * Main threat assessment function
 * Combines all factors into a weighted score
 */
export function assessThreat(
  currentLocation: Location | null,
  confirmedRoute: Route,
  locationHistory: Location[],
  deviationHistory: DeviationPoint[],
  highRiskZones: HighRiskZone[],
  locationEnabled: boolean,
  lastUpdateTime: number
): ThreatAssessment {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime;

  // Calculate individual threat factors
  const factors: ThreatFactors = {
    routeDeviation: currentLocation
      ? calculateRouteDeviationScore(currentLocation, confirmedRoute, deviationHistory)
      : 0.5, // Unknown location is concerning
    suspiciousStops: calculateSuspiciousStopsScore(locationHistory),
    highRiskZone: currentLocation
      ? calculateHighRiskZoneScore(currentLocation, highRiskZones)
      : 0,
    locationDisabled: calculateLocationDisabledScore(
      locationEnabled,
      currentLocation,
      timeSinceLastUpdate
    ),
  };

  // Calculate weighted score
  const score =
    factors.routeDeviation * THREAT_WEIGHTS.ROUTE_DEVIATION +
    factors.suspiciousStops * THREAT_WEIGHTS.SUSPICIOUS_STOPS +
    factors.highRiskZone * THREAT_WEIGHTS.HIGH_RISK_ZONE +
    factors.locationDisabled * THREAT_WEIGHTS.LOCATION_DISABLED;

  // Determine threat level and action
  let level: ThreatAssessment['level'];
  let action: ThreatAssessment['action'];

  if (score >= THREAT_THRESHOLDS.EMERGENCY_ESCALATION) {
    level = 'critical';
    action = 'emergency_escalation';
  } else if (score >= THREAT_THRESHOLDS.SILENT_DISPATCH) {
    level = 'high';
    action = 'silent_dispatch';
  } else if (score >= THREAT_THRESHOLDS.SOFT_ALERT) {
    level = 'medium';
    action = 'log';
  } else if (score > 0.2) {
    level = 'low';
    action = 'none';
  } else {
    level = 'safe';
    action = 'none';
  }

  return {
    timestamp: now,
    score,
    factors,
    level,
    action,
  };
}

/**
 * Validate community reports for manipulation resistance
 */
export function validateCommunityReport(
  report: CommunityReport,
  existingReports: CommunityReport[]
): { valid: boolean; weight: number; reason?: string } {
  // Check reporter trust score
  if (report.reporterTrustScore < COMMUNITY_SETTINGS.MIN_TRUST_SCORE) {
    return { valid: false, weight: 0, reason: 'Reporter trust score too low' };
  }

  // Check for manipulation patterns
  const sameReporterRecent = existingReports.filter(
    (r) =>
      r.reporterId === report.reporterId &&
      Date.now() - r.timestamp < 86400000 // Last 24 hours
  );

  if (sameReporterRecent.length > 5) {
    return { valid: false, weight: 0, reason: 'Suspicious reporting frequency' };
  }

  // Check for coordinated reporting (spike detection)
  const reportsInSameArea = existingReports.filter(
    (r) => calculateDistance(r.location, report.location) < 500 // 500m radius
  );

  const recentAreaReports = reportsInSameArea.filter(
    (r) => Date.now() - r.timestamp < 3600000 // Last hour
  );

  if (recentAreaReports.length > 10) {
    return { valid: false, weight: 0, reason: 'Possible coordinated manipulation' };
  }

  // Apply time decay
  const ageInDays = (Date.now() - report.timestamp) / 86400000;
  const decayFactor = Math.max(0, 1 - ageInDays / COMMUNITY_SETTINGS.DECAY_DAYS);

  // Calculate weight based on consensus and trust
  const consensusReports = reportsInSameArea.filter(
    (r) => r.type === report.type && r.isVerified
  );
  
  const hasConsensus = consensusReports.length >= COMMUNITY_SETTINGS.MIN_CONSENSUS;
  
  const weight = hasConsensus
    ? COMMUNITY_SETTINGS.MAX_WEIGHT * decayFactor * report.reporterTrustScore
    : COMMUNITY_SETTINGS.MAX_WEIGHT * 0.3 * decayFactor * report.reporterTrustScore;

  return { valid: true, weight };
}

/**
 * Calculate route safety score
 * Used for ranking multiple routes
 */
export function calculateRouteSafetyScore(
  route: Route,
  highRiskZones: HighRiskZone[],
  communityReports: CommunityReport[]
): number {
  let riskScore = 0;
  
  // Check each waypoint against high-risk zones
  for (const waypoint of route.waypoints) {
    riskScore += calculateHighRiskZoneScore(waypoint, highRiskZones);
  }
  
  // Normalize by number of waypoints
  riskScore = riskScore / route.waypoints.length;
  
  // Apply community report influence (limited weight)
  const validReports = communityReports.filter(
    (r) => validateCommunityReport(r, communityReports).valid
  );
  
  let communityRisk = 0;
  for (const report of validReports) {
    for (const waypoint of route.waypoints) {
      if (calculateDistance(waypoint, report.location) < 500) {
        const validation = validateCommunityReport(report, communityReports);
        communityRisk += report.type === 'unsafe_area' 
          ? validation.weight 
          : -validation.weight * 0.5;
      }
    }
  }
  
  communityRisk = Math.max(0, Math.min(communityRisk / route.waypoints.length, COMMUNITY_SETTINGS.MAX_WEIGHT));
  
  // Final safety score (higher = safer)
  const safetyScore = 1 - (riskScore * 0.9 + communityRisk);
  
  return Math.max(0, Math.min(safetyScore, 1));
}

/**
 * Detect if route was switched after confirmation
 * Security measure against manipulation
 */
export function detectRouteSwitching(
  originalRoute: Route,
  currentRoute: Route | null
): boolean {
  if (!currentRoute) return false;
  
  // Compare route IDs
  if (originalRoute.id !== currentRoute.id) {
    return true;
  }
  
  // Compare waypoints
  if (originalRoute.waypoints.length !== currentRoute.waypoints.length) {
    return true;
  }
  
  for (let i = 0; i < originalRoute.waypoints.length; i++) {
    const distance = calculateDistance(originalRoute.waypoints[i], currentRoute.waypoints[i]);
    if (distance > 50) { // 50m tolerance
      return true;
    }
  }
  
  return false;
}
