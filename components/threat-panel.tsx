'use client';

import { ThreatAssessment, THREAT_THRESHOLDS } from '@/lib/safety-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ThreatPanelProps {
  assessment: ThreatAssessment | null;
  isMonitoring: boolean;
  locationEnabled: boolean;
  distanceFromRoute: number;
}

export default function ThreatPanel({
  assessment,
  isMonitoring,
  locationEnabled,
  distanceFromRoute,
}: ThreatPanelProps) {
  const getThreatColor = (level: ThreatAssessment['level']) => {
    switch (level) {
      case 'safe':
        return 'bg-green-500';
      case 'low':
        return 'bg-lime-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'high':
        return 'bg-orange-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-muted';
    }
  };

  const getThreatTextColor = (level: ThreatAssessment['level']) => {
    switch (level) {
      case 'safe':
        return 'text-green-600';
      case 'low':
        return 'text-lime-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-orange-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getActionLabel = (action: ThreatAssessment['action']) => {
    switch (action) {
      case 'none':
        return 'Normal';
      case 'log':
        return 'Soft Alert';
      case 'silent_dispatch':
        return 'Silent Dispatch Active';
      case 'emergency_escalation':
        return 'EMERGENCY';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className={`${assessment?.level === 'critical' ? 'border-red-500 border-2' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>Threat Assessment</span>
          {isMonitoring && (
            <span className="flex items-center gap-2 text-sm font-normal">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Monitoring
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Threat Score</span>
            <span className={`font-semibold ${assessment ? getThreatTextColor(assessment.level) : ''}`}>
              {assessment ? `${(assessment.score * 100).toFixed(0)}%` : '--'}
            </span>
          </div>
          <div className="relative">
            <Progress 
              value={assessment ? assessment.score * 100 : 0} 
              className="h-3"
            />
            {/* Threshold markers */}
            <div 
              className="absolute top-0 w-0.5 h-3 bg-yellow-400"
              style={{ left: `${THREAT_THRESHOLDS.SOFT_ALERT * 100}%` }}
            />
            <div 
              className="absolute top-0 w-0.5 h-3 bg-orange-400"
              style={{ left: `${THREAT_THRESHOLDS.SILENT_DISPATCH * 100}%` }}
            />
            <div 
              className="absolute top-0 w-0.5 h-3 bg-red-400"
              style={{ left: `${THREAT_THRESHOLDS.EMERGENCY_ESCALATION * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Safe</span>
            <span>Critical</span>
          </div>
        </div>

        {/* Threat Level Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Threat Level</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${assessment ? getThreatColor(assessment.level) : 'bg-muted'}`}>
            {assessment ? assessment.level.toUpperCase() : 'N/A'}
          </span>
        </div>

        {/* Action Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current Action</span>
          <span className={`text-sm font-medium ${
            assessment?.action === 'emergency_escalation' ? 'text-red-600 animate-pulse' :
            assessment?.action === 'silent_dispatch' ? 'text-orange-600' :
            assessment?.action === 'log' ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {assessment ? getActionLabel(assessment.action) : 'Inactive'}
          </span>
        </div>

        {/* Factor Breakdown */}
        {assessment && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Risk Factors</h4>
            
            {/* Route Deviation (40%) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Route Deviation (40%)</span>
                <span>{(assessment.factors.routeDeviation * 100).toFixed(0)}%</span>
              </div>
              <Progress value={assessment.factors.routeDeviation * 100} className="h-1.5" />
            </div>

            {/* Suspicious Stops (30%) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Suspicious Stops (30%)</span>
                <span>{(assessment.factors.suspiciousStops * 100).toFixed(0)}%</span>
              </div>
              <Progress value={assessment.factors.suspiciousStops * 100} className="h-1.5" />
            </div>

            {/* High Risk Zone (20%) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>High-Risk Zone (20%)</span>
                <span>{(assessment.factors.highRiskZone * 100).toFixed(0)}%</span>
              </div>
              <Progress value={assessment.factors.highRiskZone * 100} className="h-1.5" />
            </div>

            {/* Location Disabled (10%) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Location Disabled (10%)</span>
                <span>{(assessment.factors.locationDisabled * 100).toFixed(0)}%</span>
              </div>
              <Progress value={assessment.factors.locationDisabled * 100} className="h-1.5" />
            </div>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <span className={`px-2 py-1 rounded text-xs ${locationEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            Location: {locationEnabled ? 'ON' : 'OFF'}
          </span>
          <span className={`px-2 py-1 rounded text-xs ${distanceFromRoute <= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            Distance: {distanceFromRoute.toFixed(0)}m
          </span>
          <span className={`px-2 py-1 rounded text-xs bg-blue-100 text-blue-700`}>
            Last Update: {assessment ? new Date(assessment.timestamp).toLocaleTimeString() : '--'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
