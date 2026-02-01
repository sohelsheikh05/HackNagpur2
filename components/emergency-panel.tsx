'use client';

import { useState } from 'react';
import { EmergencyContact, SilentDispatch, EvidencePacket } from '@/lib/safety-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmergencyPanelProps {
  contacts: EmergencyContact[];
  dispatch: SilentDispatch | null;
  sessionId: string;
  onManualEmergency: () => void;
  isEmergencyActive: boolean;
}
let alarmAudio: HTMLAudioElement | null = null;

const playAlarmAndVibrate = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([400, 200, 400, 200, 800]);
  }

  alarmAudio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
  alarmAudio.loop = true;
  alarmAudio.play().catch(() => {});
};

const stopAlarm = () => {
  alarmAudio?.pause();
  alarmAudio = null;
};



export default function EmergencyPanel({
  contacts,
  dispatch,
  sessionId,
  onManualEmergency,
  isEmergencyActive,
}: EmergencyPanelProps) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="space-y-4">
      {/* Emergency Button */}
      <Card className={isEmergencyActive ? 'border-red-500 border-2 bg-red-50' : ''}>
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            size="lg"
            className="w-full h-16 text-lg font-bold"
           onClick={() => {
  playAlarmAndVibrate();
  onManualEmergency();
}}

            disabled={isEmergencyActive}
          >
            {isEmergencyActive ? 'EMERGENCY ACTIVE' : 'MANUAL EMERGENCY'}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Tap to immediately alert contacts and emergency services
          </p>
        </CardContent>
      </Card>

      {/* Silent Dispatch Status */}
      {dispatch && (
        <Card className="border-orange-500 border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-600 flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
              Silent Dispatch Active
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Triggered at:</span>{' '}
                {new Date(dispatch.triggeredAt).toLocaleTimeString()}
              </p>
              <p>
                <span className="text-muted-foreground">Threat Score:</span>{' '}
                <span className="font-semibold text-red-600">
                  {(dispatch.threatScore * 100).toFixed(0)}%
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Emergency Services:</span>{' '}
                {dispatch.emergencyServicesNotified ? (
                  <span className="text-red-600 font-semibold">NOTIFIED (112)</span>
                ) : (
                  <span className="text-yellow-600">Standby</span>
                )}
              </p>
            </div>

            {/* Live Updates */}
            <div className="p-2 bg-muted rounded text-xs">
              <p className="font-medium mb-1">Live Updates Sending Every 10s</p>
              <p className="text-muted-foreground">
                Last: {dispatch.liveUpdates.length > 0 
                  ? `${dispatch.liveUpdates[dispatch.liveUpdates.length - 1].lat.toFixed(4)}, ${dispatch.liveUpdates[dispatch.liveUpdates.length - 1].lng.toFixed(4)}`
                  : 'Waiting...'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEvidence(!showEvidence)}
              className="w-full"
            >
              {showEvidence ? 'Hide' : 'View'} Evidence Packet
            </Button>

            {showEvidence && dispatch.evidencePacket && (
              <EvidencePacketView packet={dispatch.evidencePacket} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Emergency Contacts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Emergency Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className={`flex items-center justify-between p-2 rounded ${
                contact.notified ? 'bg-green-50 border border-green-200' : 'bg-muted'
              }`}
            >
              <div>
                <p className="font-medium text-sm">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{contact.relationship}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{contact.phone}</p>
                {contact.notified && (
                  <p className="text-xs text-green-600 font-medium">
                    Notified {contact.notifiedAt ? new Date(contact.notifiedAt).toLocaleTimeString() : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Simulated WhatsApp Message Preview */}
      {isEmergencyActive && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">Message Sent to Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded-lg p-3 shadow-sm text-sm">
              <p className="font-medium text-red-600 mb-2">SAFETY ALERT</p>
              <p className="text-gray-700 mb-2">
                Your contact may be in danger during their ride.
              </p>
              <p className="text-gray-600 text-xs mb-2">
                <strong>Session ID:</strong> {sessionId}
              </p>
              <p className="text-blue-600 text-xs underline">
                [Click to track live location]
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EvidencePacketView({ packet }: { packet: EvidencePacket }) {
  return (
    <div className="p-3 bg-muted rounded text-xs space-y-2 max-h-64 overflow-y-auto">
      <p className="font-semibold">Evidence Packet</p>
      
      <div>
        <p className="text-muted-foreground">Session ID</p>
        <p className="font-mono">{packet.sessionId}</p>
      </div>
      
      <div>
        <p className="text-muted-foreground">Timestamp</p>
        <p>{new Date(packet.timestamp).toLocaleString()}</p>
      </div>
      
      <div>
        <p className="text-muted-foreground">Escalation Reason</p>
        <p className="text-red-600">{packet.escalationReason}</p>
      </div>
      
      {packet.vehicleInfo && (
        <div>
          <p className="text-muted-foreground">Vehicle Info</p>
          <p>Plate: {packet.vehicleInfo.licensePlate}</p>
          <p>Driver: {packet.vehicleInfo.driverName}</p>
          <p>Vehicle: {packet.vehicleInfo.vehicleColor} {packet.vehicleInfo.vehicleModel}</p>
        </div>
      )}
      
      <div>
        <p className="text-muted-foreground">GPS History ({packet.gpsHistory.length} points)</p>
        <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
          {packet.gpsHistory.slice(-5).map((loc, i) => (
            <p key={i}>
              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} @ {new Date(loc.timestamp).toLocaleTimeString()}
            </p>
          ))}
        </div>
      </div>
      
      {packet.deviationPoints.length > 0 && (
        <div>
          <p className="text-muted-foreground">Deviation Points ({packet.deviationPoints.length})</p>
          <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
            {packet.deviationPoints.map((dev, i) => (
              <p key={i}>
                {dev.distanceFromRoute.toFixed(0)}m from route for {(dev.duration / 1000).toFixed(0)}s
              </p>
            ))}
          </div>
        </div>
      )}
      
      <div>
        <p className="text-muted-foreground">Contacts Notified</p>
        {packet.emergencyContactsNotified.map((c) => (
          <p key={c.id}>{c.name} ({c.phone})</p>
        ))}
      </div>
    </div>
  );
}
