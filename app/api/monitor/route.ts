// API Route for Real-time Monitoring and Threat Assessment
// Handles location updates, threat scoring, and emergency dispatch

import { NextRequest, NextResponse } from 'next/server';
import {
  RideSession,
  Location,
  ThreatAssessment,
  DeviationPoint,
  EvidencePacket,
  SilentDispatch,
  LOCATION_UPDATE_INTERVAL,
} from '@/lib/safety-types';
import {
  assessThreat,
  distanceFromRoute,
  calculateDistance,
} from '@/lib/safety-engine';
import { mockHighRiskZones } from '@/lib/mock-data';
import { sendAlertEmail, sendLocationUpdateEmail } from '@/lib/email-service';

// In-memory storage (shared with ride route in production)
const rideSessions = new Map<string, RideSession>();
const silentDispatches = new Map<string, SilentDispatch>();
const deviationHistories = new Map<string, DeviationPoint[]>();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'update-location': {
      /**
       * CONTINUOUS BACKGROUND MONITORING
       * This endpoint simulates the background service that would run on a mobile device
       * Tracks: position, deviation, stops, risk zones, location service status
       */
      const { sessionId, location, locationEnabled = true, session: clientSession } = body;
      
      // Use client-provided session for this demo (in production, would use server-side storage)
      let session: RideSession | undefined = clientSession || rideSessions.get(sessionId);
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      const currentLocation: Location = {
        ...location,
        timestamp: Date.now(),
        source: location.source || 'gps',
      };

      // Update location history
      session.locationHistory.push(currentLocation);
      
      // Keep only last 100 locations to prevent memory issues
      if (session.locationHistory.length > 100) {
        session.locationHistory = session.locationHistory.slice(-100);
      }

      // Get or initialize deviation history
      let deviationHistory = deviationHistories.get(sessionId) || [];
      
      // Check for route deviation
      const distanceFromConfirmedRoute = distanceFromRoute(currentLocation, session.confirmedRoute);
      
      if (distanceFromConfirmedRoute > 100) { // Outside safe corridor
        // Check if this is a continuation of existing deviation
        const lastDeviation = deviationHistory[deviationHistory.length - 1];
        
        if (lastDeviation && Date.now() - lastDeviation.timestamp < LOCATION_UPDATE_INTERVAL * 2) {
          // Update existing deviation
          lastDeviation.duration = Date.now() - (lastDeviation.timestamp - lastDeviation.duration);
          lastDeviation.distanceFromRoute = distanceFromConfirmedRoute;
        } else {
          // New deviation point
          deviationHistory.push({
            location: currentLocation,
            distanceFromRoute: distanceFromConfirmedRoute,
            duration: 0,
            timestamp: Date.now(),
          });
        }
      }

      // Keep only recent deviations
      deviationHistory = deviationHistory.filter(
        (d) => Date.now() - d.timestamp < 600000 // Last 10 minutes
      );
      deviationHistories.set(sessionId, deviationHistory);

      // THREAT SCORING ENGINE
      const lastUpdateTime = session.locationHistory.length > 1
        ? session.locationHistory[session.locationHistory.length - 2].timestamp
        : session.startTime;

      const threatAssessment = assessThreat(
        currentLocation,
        session.confirmedRoute,
        session.locationHistory,
        deviationHistory,
        mockHighRiskZones,
        locationEnabled,
        lastUpdateTime
      );

      // Add to threat history
      session.threatHistory.push(threatAssessment);
      
      // Keep only last 50 assessments
      if (session.threatHistory.length > 50) {
        session.threatHistory = session.threatHistory.slice(-50);
      }

      // Store updated session
      rideSessions.set(sessionId, session);

      // Check for escalation actions
      let escalationResult = null;
      
      if (threatAssessment.action === 'silent_dispatch' || threatAssessment.action === 'emergency_escalation') {
        escalationResult = await handleEscalation(session, threatAssessment, currentLocation);
      }

      return NextResponse.json({
        success: true,
        threatAssessment,
        distanceFromRoute: distanceFromConfirmedRoute,
        isDeviated: distanceFromConfirmedRoute > 100,
        escalation: escalationResult,
        session: {
          id: session.id,
          status: session.status,
          locationHistory: session.locationHistory.slice(-10), // Last 10 locations
          threatHistory: session.threatHistory.slice(-5), // Last 5 assessments
        },
      });
    }

    case 'location-disabled': {
      /**
       * HIGH-RISK EVENT: Location services turned OFF mid-ride
       * Immediately triggers threat assessment with location_disabled factor
       */
      const { sessionId, lastKnownLocation, session: clientSession } = body;
      
      const session: RideSession | undefined = clientSession || rideSessions.get(sessionId);
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      // Store last known location
      if (lastKnownLocation) {
        session.locationHistory.push({
          ...lastKnownLocation,
          timestamp: Date.now(),
          source: 'last_known',
        });
      }

      // Perform threat assessment with location disabled
      const deviationHistory = deviationHistories.get(sessionId) || [];
      
      const threatAssessment = assessThreat(
        lastKnownLocation || null,
        session.confirmedRoute,
        session.locationHistory,
        deviationHistory,
        mockHighRiskZones,
        false, // Location is disabled
        Date.now() - 60000 // Simulate stale data
      );

      session.threatHistory.push(threatAssessment);
      rideSessions.set(sessionId, session);

      // This is always at least a medium-level threat
      let escalationResult = null;
      if (threatAssessment.score >= 0.4) {
        escalationResult = await handleEscalation(session, threatAssessment, lastKnownLocation);
      }

      return NextResponse.json({
        success: true,
        threatAssessment,
        escalation: escalationResult,
        warning: 'Location services disabled - treated as high-risk event',
      });
    }

    case 'network-loss': {
      /**
       * SIMULATED: Airplane mode or network loss detection
       * In production, this would be detected by the mobile OS
       */
      const { sessionId, lastKnownLocation, duration, session: clientSession } = body;
      
      const session: RideSession | undefined = clientSession || rideSessions.get(sessionId);
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      // Calculate threat based on network loss duration
      const networkLossThreat = Math.min(duration / 300000, 1); // Max at 5 minutes
      
      const deviationHistory = deviationHistories.get(sessionId) || [];
      
      const threatAssessment = assessThreat(
        lastKnownLocation || null,
        session.confirmedRoute,
        session.locationHistory,
        deviationHistory,
        mockHighRiskZones,
        true, // Location might still be working
        Date.now() - duration
      );

      // Add network loss factor
      threatAssessment.score = Math.min(threatAssessment.score + networkLossThreat * 0.2, 1);

      session.threatHistory.push(threatAssessment);
      rideSessions.set(sessionId, session);

      return NextResponse.json({
        success: true,
        threatAssessment,
        networkLossDuration: duration,
        warning: 'Network connectivity lost',
      });
    }

    case 'manual-emergency': {
      /**
       * Manual emergency trigger (panic button fallback)
       * Immediately escalates to maximum threat level
       */
      const { sessionId, location, session: clientSession } = body;
      
      const session: RideSession | undefined = clientSession || rideSessions.get(sessionId);
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      session.status = 'emergency';
      rideSessions.set(sessionId, session);

      const manualThreat: ThreatAssessment = {
        timestamp: Date.now(),
        score: 1.0,
        factors: {
          routeDeviation: 0,
          suspiciousStops: 0,
          highRiskZone: 0,
          locationDisabled: 0,
        },
        level: 'critical',
        action: 'emergency_escalation',
      };

      const escalationResult = await handleEscalation(session, manualThreat, location);

      return NextResponse.json({
        success: true,
        threatAssessment: manualThreat,
        escalation: escalationResult,
        message: 'Emergency services notified',
      });
    }

    case 'force-threat-level': {
      /**
       * TESTING ONLY: Force a specific threat score
       * Allows testing all threshold behaviors
       */
      const { sessionId, location, forcedScore, session: clientSession } = body;
      
      const session: RideSession | undefined = clientSession || rideSessions.get(sessionId);
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      // Determine level and action based on forced score
      let level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
      let action: 'none' | 'log' | 'silent_dispatch' | 'emergency_escalation';
      
      if (forcedScore < 0.2) {
        level = 'safe';
        action = 'none';
      } else if (forcedScore < 0.4) {
        level = 'low';
        action = 'none';
      } else if (forcedScore < 0.7) {
        level = 'medium';
        action = 'log';
      } else if (forcedScore < 0.9) {
        level = 'high';
        action = 'silent_dispatch';
      } else {
        level = 'critical';
        action = 'emergency_escalation';
      }

      const forcedThreat: ThreatAssessment = {
        timestamp: Date.now(),
        score: forcedScore,
        factors: {
          routeDeviation: forcedScore * 0.4,
          suspiciousStops: forcedScore * 0.3,
          highRiskZone: forcedScore * 0.2,
          locationDisabled: forcedScore * 0.1,
        },
        level,
        action,
      };

      session.threatHistory.push(forcedThreat);
      
      if (forcedScore >= 0.9) {
        session.status = 'emergency';
      }
      
      rideSessions.set(sessionId, session);

      let escalationResult = null;
      if (action === 'silent_dispatch' || action === 'emergency_escalation') {
        escalationResult = await handleEscalation(session, forcedThreat, location);
      }

      return NextResponse.json({
        success: true,
        threatAssessment: forcedThreat,
        escalation: escalationResult,
        message: `Threat level forced to ${(forcedScore * 100).toFixed(0)}% (${level})`,
      });
    }

    default:
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
  }
}

/**
 * SILENT DISPATCH AND EMERGENCY ESCALATION
 * Handles automatic emergency response without requiring user interaction
 */
async function handleEscalation(
  session: RideSession,
  threatAssessment: ThreatAssessment,
  currentLocation: Location | null
): Promise<{
  dispatchId: string;
  actions: string[];
  evidencePacket: EvidencePacket;
}> {
  const dispatchId = `dispatch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const actions: string[] = [];

  // Create evidence packet
  const evidencePacket: EvidencePacket = {
    sessionId: session.id,
    timestamp: Date.now(),
    gpsHistory: session.locationHistory,
    deviationPoints: (deviationHistories.get(session.id) || []),
    threatAssessments: session.threatHistory,
    escalationReason: `Threat level: ${threatAssessment.level}, Score: ${threatAssessment.score.toFixed(2)}`,
    vehicleInfo: session.vehicleInfo,
    emergencyContactsNotified: [],
  };

  // Silent Dispatch Actions
  if (threatAssessment.action === 'silent_dispatch' || threatAssessment.action === 'emergency_escalation') {
    // 1. Start sending live location updates every 10 seconds
    actions.push('LIVE_LOCATION_TRACKING_STARTED');
    
    const isEmergency = threatAssessment.action === 'emergency_escalation';
    const riderName = session.vehicleInfo?.driverName || 'SafeRide User';
    
    // 2. Notify emergency contacts via EMAIL
    for (const contact of session.emergencyContacts) {
      if (!contact.notified && contact.email) {
        // Send real email notification
        const emailResult = await sendAlertEmail({
          contact,
          riderName,
          threatLevel: isEmergency ? 'emergency' : 'dispatch',
          threatScore: threatAssessment.score,
          location: currentLocation || session.locationHistory[session.locationHistory.length - 1],
          vehicleInfo: session.vehicleInfo,
          evidencePacket,
        });
        
        if (emailResult.success) {
          actions.push(`EMAIL_SENT: ${contact.name} (${contact.email})`);
          contact.notified = true;
          contact.notifiedAt = Date.now();
          evidencePacket.emergencyContactsNotified.push(contact);
        } else {
          actions.push(`EMAIL_FAILED: ${contact.name} - ${emailResult.error}`);
          console.error(`Failed to send email to ${contact.email}:`, emailResult.error);
        }
      }
    }
  }

  // Emergency Escalation (highest threat level)
  if (threatAssessment.action === 'emergency_escalation') {
    // 3. Auto-trigger 112 emergency call simulation
    actions.push('EMERGENCY_SERVICES_112_NOTIFIED');
    
    console.log(`[SIMULATED 112 CALL]`);
    console.log(`Emergency Type: Potential kidnapping/safety threat`);
    console.log(`Location: ${currentLocation?.lat}, ${currentLocation?.lng}`);
    console.log(`Vehicle: ${session.vehicleInfo?.licensePlate || 'Unknown'}`);
    console.log(`Evidence packet ID: ${dispatchId}`);
  }

  // Store dispatch record
  const dispatch: SilentDispatch = {
    id: dispatchId,
    sessionId: session.id,
    triggeredAt: Date.now(),
    threatScore: threatAssessment.score,
    lastKnownLocation: currentLocation || session.locationHistory[session.locationHistory.length - 1],
    liveUpdates: currentLocation ? [currentLocation] : [],
    emergencyServicesNotified: threatAssessment.action === 'emergency_escalation',
    contactsNotified: session.emergencyContacts.filter(c => c.notified).map(c => c.id),
    evidencePacket,
  };

  silentDispatches.set(dispatchId, dispatch);

  // Update session status
  session.status = 'emergency';
  rideSessions.set(session.id, session);

  return {
    dispatchId,
    actions,
    evidencePacket,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dispatchId = searchParams.get('dispatchId');

  if (!dispatchId) {
    return NextResponse.json(
      { error: 'Dispatch ID required' },
      { status: 400 }
    );
  }

  const dispatch = silentDispatches.get(dispatchId);
  if (!dispatch) {
    return NextResponse.json(
      { error: 'Dispatch not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    dispatch,
  });
}
