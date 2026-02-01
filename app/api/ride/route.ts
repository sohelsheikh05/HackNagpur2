// API Route for Ride Session Management
// Handles ride creation, route selection, and monitoring using OSRM for real routing

import { NextRequest, NextResponse } from 'next/server';
import {
  RideSession,
  Route,
  Location,
  SAFE_CORRIDOR_RADIUS,
} from '@/lib/safety-types';
import { calculateRouteSafetyScore } from '@/lib/safety-engine';
import {
  mockHighRiskZones,
  mockCommunityReports,
  mockEmergencyContacts,
} from '@/lib/mock-data';
import { getRouteAlternatives, calculateStraightLineDistance } from '@/lib/routing-service';

// In-memory storage for ride sessions (would be database in production)
const rideSessions = new Map<string, RideSession>();

// Generate unique session ID
function generateSessionId(): string {
  return `ride-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'create': {
      // Create new ride session with route options
      const { source, destination, vehicleInfo, userId = 'user-001' } = body;
      
      if (!source || !destination) {
        return NextResponse.json(
          { error: 'Source and destination are required' },
          { status: 400 }
        );
      }

      const sourceLocation: Location = {
        ...source,
        timestamp: Date.now(),
        source: source.source || 'gps',
      };

      const destLocation: Location = {
        ...destination,
        timestamp: Date.now(),
        source: destination.source || 'gps',
      };

      try {
        // Get real road routes from OSRM
        const routeResults = await getRouteAlternatives(sourceLocation, destLocation, 3);

        // Generate Route objects with safety scores
        const routes: Route[] = routeResults.map((routeData, index) => {
          const route: Route = {
            id: `route-${index}-${Date.now()}`,
            waypoints: routeData.waypoints,
            safetyScore: 0, // Will be calculated
            distance: routeData.distance,
            estimatedDuration: routeData.duration,
            highRiskZones: mockHighRiskZones.filter((zone) => {
              // Check if route passes through this zone
              return routeData.waypoints.some((wp) => {
                const latDiff = wp.lat - zone.center.lat;
                const lngDiff = wp.lng - zone.center.lng;
                const dist = Math.sqrt(latDiff ** 2 + lngDiff ** 2) * 111000;
                return dist < zone.radius + SAFE_CORRIDOR_RADIUS;
              });
            }),
          };

          // Calculate safety score
          route.safetyScore = calculateRouteSafetyScore(
            route,
            mockHighRiskZones,
            mockCommunityReports
          );

          return route;
        });

        // Sort routes by safety score (highest first)
        routes.sort((a, b) => b.safetyScore - a.safetyScore);

        // Create session
        const sessionId = generateSessionId();
        const session: RideSession = {
          id: sessionId,
          userId,
          source: sourceLocation,
          destination: destLocation,
          confirmedRoute: routes[0], // Default to safest route
          alternativeRoutes: routes,
          startTime: Date.now(),
          status: 'setup',
          locationHistory: [sourceLocation],
          threatHistory: [],
          emergencyContacts: mockEmergencyContacts,
          vehicleInfo,
        };

        rideSessions.set(sessionId, session);

        return NextResponse.json({
          success: true,
          sessionId,
          routes,
          highRiskZones: mockHighRiskZones,
          communityReports: mockCommunityReports,
        });
      } catch (error) {
        console.error('Failed to get routes:', error);
        
        // Fallback to simple route if OSRM fails
        const fallbackDistance = calculateStraightLineDistance(sourceLocation, destLocation);
        const fallbackRoute: Route = {
          id: `route-fallback-${Date.now()}`,
          waypoints: [sourceLocation, destLocation],
          safetyScore: 0.5,
          distance: fallbackDistance,
          estimatedDuration: fallbackDistance / 500,
          highRiskZones: [],
        };

        const sessionId = generateSessionId();
        const session: RideSession = {
          id: sessionId,
          userId,
          source: sourceLocation,
          destination: destLocation,
          confirmedRoute: fallbackRoute,
          alternativeRoutes: [fallbackRoute],
          startTime: Date.now(),
          status: 'setup',
          locationHistory: [sourceLocation],
          threatHistory: [],
          emergencyContacts: mockEmergencyContacts,
          vehicleInfo,
        };

        rideSessions.set(sessionId, session);

        return NextResponse.json({
          success: true,
          sessionId,
          routes: [fallbackRoute],
          highRiskZones: mockHighRiskZones,
          communityReports: mockCommunityReports,
          warning: 'Using fallback routing due to service unavailability',
        });
      }
    }

    case 'confirm-route': {
      // User confirms selected route - becomes baseline contract
      const { sessionId, routeId } = body;
      
      const session = rideSessions.get(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      const selectedRoute = session.alternativeRoutes.find((r) => r.id === routeId);
      if (!selectedRoute) {
        return NextResponse.json(
          { error: 'Route not found' },
          { status: 404 }
        );
      }

      // Update session with confirmed route
      session.confirmedRoute = selectedRoute;
      session.status = 'active';
      rideSessions.set(sessionId, session);

      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          confirmedRoute: session.confirmedRoute,
          startTime: session.startTime,
        },
      });
    }

    case 'get-session': {
      const { sessionId } = body;
      
      const session = rideSessions.get(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session,
        highRiskZones: mockHighRiskZones,
      });
    }

    case 'end-ride': {
      const { sessionId, reason = 'completed' } = body;
      
      const session = rideSessions.get(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      session.status = reason === 'emergency' ? 'emergency' : 'completed';
      rideSessions.set(sessionId, session);

      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
        },
      });
    }

    default:
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  const session = rideSessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    session,
    highRiskZones: mockHighRiskZones,
  });
}
