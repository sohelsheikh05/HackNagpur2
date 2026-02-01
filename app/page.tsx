'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RideSession,
  Route,
  Location,
  ThreatAssessment,
  SilentDispatch,
  HighRiskZone,
  LOCATION_UPDATE_INTERVAL,
} from '@/lib/safety-types';
import { distanceFromRoute } from '@/lib/safety-engine';
import { mockHighRiskZones } from '@/lib/mock-data';
import type { EmergencyContact } from '@/lib/safety-types';
import { mockEmergencyContacts } from '@/lib/mock-data'; // Declare the variable before using it

import RideSetup from '@/components/ride-setup';
import RideMap from '@/components/ride-map';
import ThreatPanel from '@/components/threat-panel';
import EmergencyPanel from '@/components/emergency-panel';
import SimulationControls from '@/components/simulation-controls';

type AppState = 'setup' | 'monitoring' | 'completed' | 'emergency';

export default function SafeRidePage() {
  // App state
  const [appState, setAppState] = useState<AppState>('setup');
  const [isLoading, setIsLoading] = useState(false);
  
  // Session data
  const [session, setSession] = useState<RideSession | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [confirmedRoute, setConfirmedRoute] = useState<Route | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<Route[]>([]);
  const [highRiskZones] = useState<HighRiskZone[]>(mockHighRiskZones);
  
  // Location tracking
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [locationEnabled, setLocationEnabled] = useState(true);
  
  // Threat assessment
  const [threatAssessment, setThreatAssessment] = useState<ThreatAssessment | null>(null);
  const [distanceFromConfirmedRoute, setDistanceFromConfirmedRoute] = useState(0);
  const [isDeviated, setIsDeviated] = useState(false);
  
  // Emergency dispatch
  const [silentDispatch, setSilentDispatch] = useState<SilentDispatch | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  
  // Simulation
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const simulationIndexRef = useRef(0);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle ride creation from setup component
  const handleRideCreated = useCallback((newSessionId: string, routes: Route[], selectedRoute: Route, contacts: EmergencyContact[]) => {
    setSessionId(newSessionId);
    setConfirmedRoute(selectedRoute);
    setAlternativeRoutes(routes);
    setEmergencyContacts(contacts);
    
    // Initialize session
    const initialSession: RideSession = {
      id: newSessionId,
      userId: 'user-001',
      source: selectedRoute.waypoints[0],
      destination: selectedRoute.waypoints[selectedRoute.waypoints.length - 1],
      confirmedRoute: selectedRoute,
      alternativeRoutes: routes,
      startTime: Date.now(),
      status: 'active',
      locationHistory: [selectedRoute.waypoints[0]],
      threatHistory: [],
      emergencyContacts: contacts,
    };
    
    setSession(initialSession);
    setCurrentLocation(selectedRoute.waypoints[0]);
    setLocationHistory([selectedRoute.waypoints[0]]);
    simulationIndexRef.current = 0;
    setAppState('monitoring');
  }, []);

  // Refs to avoid stale closures in callbacks
  const locationHistoryRef = useRef<Location[]>([]);
  const sessionRef = useRef<RideSession | null>(null);

  // Keep refs in sync
  useEffect(() => {
    locationHistoryRef.current = locationHistory;
  }, [locationHistory]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Send location update to monitoring API
  const sendLocationUpdate = useCallback(async (location: Location, isLocationEnabled: boolean) => {
    if (!sessionRef.current || !confirmedRoute) return;

    try {
      const response = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLocationEnabled ? 'update-location' : 'location-disabled',
          sessionId,
          location,
          locationEnabled: isLocationEnabled,
          lastKnownLocation: location,
          session: {
            ...sessionRef.current,
            locationHistory: [...locationHistoryRef.current, location],
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setThreatAssessment(data.threatAssessment);
        setDistanceFromConfirmedRoute(data.distanceFromRoute || 0);
        setIsDeviated(data.isDeviated || false);

        // Handle escalation
        if (data.escalation) {
          setSilentDispatch({
            id: data.escalation.dispatchId,
            sessionId,
            triggeredAt: Date.now(),
            threatScore: data.threatAssessment.score,
            lastKnownLocation: location,
            liveUpdates: [location],
            emergencyServicesNotified: data.threatAssessment.action === 'emergency_escalation',
            contactsNotified: data.escalation.evidencePacket.emergencyContactsNotified.map((c: { id: string }) => c.id),
            evidencePacket: data.escalation.evidencePacket,
          });

          // Update emergency contacts notification status
          setEmergencyContacts((prev) =>
            prev.map((contact) => ({
              ...contact,
              notified: data.escalation.evidencePacket.emergencyContactsNotified.some(
                (c: { id: string }) => c.id === contact.id
              ),
              notifiedAt: Date.now(),
            }))
          );

          if (data.threatAssessment.action === 'emergency_escalation') {
            setAppState('emergency');
          }
        }
      }
    } catch (error) {
      console.error('Failed to send location update:', error);
    }
  }, [confirmedRoute, sessionId]);

  // Monitor location changes
  useEffect(() => {
    if (appState !== 'monitoring' && appState !== 'emergency') return;
    if (!currentLocation) return;

    // Update location history
    setLocationHistory((prev) => {
      const newHistory = [...prev, currentLocation];
      return newHistory.slice(-100); // Keep last 100 points
    });

    // Calculate distance from route
    if (confirmedRoute) {
      const distance = distanceFromRoute(currentLocation, confirmedRoute);
      setDistanceFromConfirmedRoute(distance);
      setIsDeviated(distance > 100);
    }

    // Send update to monitoring API
    sendLocationUpdate(currentLocation, locationEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, appState, confirmedRoute, locationEnabled]);

  // Simulation: Auto-move along route
  useEffect(() => {
    if (!simulationRunning || !confirmedRoute || appState !== 'monitoring') {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
      return;
    }

    const interval = LOCATION_UPDATE_INTERVAL / simulationSpeed;

    monitoringIntervalRef.current = setInterval(() => {
      if (simulationIndexRef.current < confirmedRoute.waypoints.length - 1) {
        simulationIndexRef.current += 1;
        const nextPoint = confirmedRoute.waypoints[simulationIndexRef.current];
        setCurrentLocation({
          ...nextPoint,
          timestamp: Date.now(),
          source: 'gps',
        });
      } else {
        // Reached destination
        setSimulationRunning(false);
        setAppState('completed');
      }
    }, interval);

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, [simulationRunning, confirmedRoute, simulationSpeed, appState]);

  // Simulation controls
  const handleSimulateDeviation = (amount: number) => {
    if (!currentLocation) return;
    
    setSimulationRunning(false);
    
    const latOffset = (amount / 111000) * (Math.random() > 0.5 ? 1 : -1);
    const lngOffset = (amount / 111000) * (Math.random() > 0.5 ? 1 : -1);
    
    const deviatedLocation: Location = {
      lat: currentLocation.lat + latOffset,
      lng: currentLocation.lng + lngOffset,
      timestamp: Date.now(),
      source: 'gps',
    };
    
    setCurrentLocation(deviatedLocation);
  };

  const handleSimulateStop = () => {
    if (!currentLocation) return;
    
    setSimulationRunning(false);
    
    const stoppedLocation: Location = {
      ...currentLocation,
      timestamp: Date.now(),
    };

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        setCurrentLocation({
          ...stoppedLocation,
          timestamp: Date.now(),
        });
      }, i * 2000);
    }
  };

  const handleSimulateNetworkLoss = async () => {
    if (!session) return;
    
    const location = currentLocation || confirmedRoute?.waypoints[0] || { lat: 0, lng: 0, timestamp: Date.now() };

    try {
      const response = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'network-loss',
          sessionId,
          lastKnownLocation: location,
          duration: 120000,
          session,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.threatAssessment) {
        setThreatAssessment(data.threatAssessment);
      }
    } catch (error) {
      console.error('Failed to simulate network loss:', error);
    }
  };

  const handleToggleLocation = (enabled: boolean) => {
    setLocationEnabled(enabled);
    
    if (!enabled && currentLocation) {
      sendLocationUpdate(currentLocation, false);
    }
  };

  const handleManualEmergency = async () => {
    if (!session) return;
    
    const location = currentLocation || confirmedRoute?.waypoints[0] || { lat: 0, lng: 0, timestamp: Date.now() };

    try {
      const response = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual-emergency',
          sessionId,
          location,
          session,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setThreatAssessment(data.threatAssessment);
        setAppState('emergency');

        if (data.escalation) {
          setSilentDispatch({
            id: data.escalation.dispatchId,
            sessionId,
            triggeredAt: Date.now(),
            threatScore: 1.0,
            lastKnownLocation: location,
            liveUpdates: [location],
            emergencyServicesNotified: true,
            contactsNotified: emergencyContacts.map((c) => c.id),
            evidencePacket: data.escalation.evidencePacket,
          });

          setEmergencyContacts((prev) =>
            prev.map((contact) => ({
              ...contact,
              notified: true,
              notifiedAt: Date.now(),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to trigger manual emergency:', error);
    }
  };

  const handleEndRide = async () => {
    setSimulationRunning(false);
    
    try {
      await fetch('/api/ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end-ride',
          sessionId,
          reason: 'completed',
        }),
      });
    } catch (error) {
      console.error('Failed to end ride:', error);
    }

    setAppState('completed');
  };

  const handleStartNewRide = () => {
    setAppState('setup');
    setSession(null);
    setSessionId('');
    setConfirmedRoute(null);
    setAlternativeRoutes([]);
    setCurrentLocation(null);
    setLocationHistory([]);
    setThreatAssessment(null);
    setDistanceFromConfirmedRoute(0);
    setIsDeviated(false);
    setSilentDispatch(null);
    setEmergencyContacts([]);
    setSimulationRunning(false);
    simulationIndexRef.current = 0;
  };

  // Force a specific threat level for testing
  const handleForceThreshold = async (level: 'safe' | 'alert' | 'dispatch' | 'emergency') => {
    if (!session) return;
    
    // Use current location or fallback to route start
    const location = currentLocation || confirmedRoute?.waypoints[0] || { lat: 0, lng: 0, timestamp: Date.now() };

    const scoreMap = {
      safe: 0.2,
      alert: 0.5,
      dispatch: 0.8,
      emergency: 0.95,
    };

    const score = scoreMap[level];

    try {
      const response = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force-threat-level',
          sessionId,
          location,
          forcedScore: score,
          session,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setThreatAssessment(data.threatAssessment);

        if (data.escalation) {
          setSilentDispatch({
            id: data.escalation.dispatchId,
            sessionId,
            triggeredAt: Date.now(),
            threatScore: score,
            lastKnownLocation: location,
            liveUpdates: [location],
            emergencyServicesNotified: level === 'emergency',
            contactsNotified: data.escalation.evidencePacket.emergencyContactsNotified.map((c: { id: string }) => c.id),
            evidencePacket: data.escalation.evidencePacket,
          });

          setEmergencyContacts((prev) =>
            prev.map((contact) => ({
              ...contact,
              notified: data.escalation.evidencePacket.emergencyContactsNotified.some(
                (c: { id: string }) => c.id === contact.id
              ),
              notifiedAt: Date.now(),
            }))
          );
        }

        if (level === 'emergency') {
          setAppState('emergency');
        }
      }
    } catch (error) {
      console.error('Failed to force threat level:', error);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">SafeRide</h1>
              <p className="text-sm text-muted-foreground">Passive Safety Monitoring System</p>
            </div>
            <div className="flex items-center gap-4">
              {appState !== 'setup' && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  appState === 'monitoring' ? 'bg-green-100 text-green-700' :
                  appState === 'emergency' ? 'bg-red-100 text-red-700 animate-pulse' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {appState === 'monitoring' && 'Active'}
                  {appState === 'emergency' && 'EMERGENCY'}
                  {appState === 'completed' && 'Completed'}
                </div>
              )}
              {sessionId && (
                <span className="text-xs text-muted-foreground font-mono">
                  {sessionId.slice(0, 12)}...
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {appState === 'setup' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h2 className="font-semibold text-blue-800 mb-2">How It Works</h2>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>1. Search and select your pickup and drop-off locations</li>
                <li>2. Add cab/vehicle details for safety tracking</li>
                <li>3. View available routes on the map and select your preferred one</li>
                <li>4. Review and confirm the exact route your cab will take</li>
                <li>5. System monitors passively and alerts if deviations detected</li>
              </ul>
            </div>
            <RideSetup onRideCreated={handleRideCreated} isLoading={isLoading} />
          </div>
        )}

        {(appState === 'monitoring' || appState === 'emergency') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map - Takes 2 columns */}
            <div className="lg:col-span-2 h-[500px]">
              <RideMap
                currentLocation={currentLocation}
                confirmedRoute={confirmedRoute}
                alternativeRoutes={alternativeRoutes}
                highRiskZones={highRiskZones}
                locationHistory={locationHistory}
                isDeviated={isDeviated}
                threatLevel={threatAssessment?.level || 'safe'}
              />
            </div>

            {/* Right Panel */}
            <div className="space-y-4">
              <ThreatPanel
                assessment={threatAssessment}
                isMonitoring={appState === 'monitoring' || appState === 'emergency'}
                locationEnabled={locationEnabled}
                distanceFromRoute={distanceFromConfirmedRoute}
              />

              <EmergencyPanel
                contacts={emergencyContacts}
                dispatch={silentDispatch}
                sessionId={sessionId}
                onManualEmergency={handleManualEmergency}
                isEmergencyActive={appState === 'emergency'}
              />
            </div>

            {/* Simulation Controls - Full width below */}
            <div className="lg:col-span-3">
              <SimulationControls
                isRunning={simulationRunning}
                locationEnabled={locationEnabled}
                onToggleSimulation={() => setSimulationRunning(!simulationRunning)}
                onToggleLocation={handleToggleLocation}
                onSimulateDeviation={handleSimulateDeviation}
                onSimulateStop={handleSimulateStop}
                onSimulateNetworkLoss={handleSimulateNetworkLoss}
                onEndRide={handleEndRide}
                onForceThreshold={handleForceThreshold}
                currentSpeed={simulationSpeed}
                onSpeedChange={setSimulationSpeed}
              />
            </div>
          </div>
        )}

        {appState === 'completed' && (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="p-8 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-green-800 mb-2">Ride Completed Safely</h2>
              <p className="text-green-700">Thank you for using SafeRide. Your journey has been recorded.</p>
            </div>

            {/* Ride Summary */}
            {session && (
              <div className="p-4 bg-card border rounded-lg text-left">
                <h3 className="font-medium mb-3">Ride Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{Math.round((Date.now() - session.startTime) / 60000)} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance</span>
                    <span>{confirmedRoute ? (confirmedRoute.distance / 1000).toFixed(1) : 0} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location Updates</span>
                    <span>{locationHistory.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Threat Assessments</span>
                    <span>{session.threatHistory.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Threat Level</span>
                    <span className="capitalize">
                      {session.threatHistory.length > 0
                        ? session.threatHistory.reduce((max, t) => t.score > max.score ? t : max).level
                        : 'Safe'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleStartNewRide}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start New Ride
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>SafeRide - Passive Ride Safety Monitoring System</p>
          <p className="text-xs mt-1">
            This is a prototype demonstration. Emergency services simulation only.
          </p>
        </div>
      </footer>
    </main>
  );
}
