'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Zap, Shield, Siren } from 'lucide-react';

interface SimulationControlsProps {
  isRunning: boolean;
  locationEnabled: boolean;
  onToggleSimulation: () => void;
  onToggleLocation: (enabled: boolean) => void;
  onSimulateDeviation: (amount: number) => void;
  onSimulateStop: () => void;
  onSimulateNetworkLoss: () => void;
  onEndRide: () => void;
  onForceThreshold: (level: 'safe' | 'alert' | 'dispatch' | 'emergency') => void;
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export default function SimulationControls({
  isRunning,
  locationEnabled,
  onToggleSimulation,
  onToggleLocation,
  onSimulateDeviation,
  onSimulateStop,
  onSimulateNetworkLoss,
  onEndRide,
  onForceThreshold,
  currentSpeed,
  onSpeedChange,
}: SimulationControlsProps) {
  const [deviationAmount, setDeviationAmount] = useState(200);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Simulation Controls</CardTitle>
        <CardDescription className="text-xs">
          Test the safety system by simulating various scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* DIRECT THRESHOLD TEST BUTTONS */}
        <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <Label className="font-medium text-blue-700 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Quick Test - Force Threat Level
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Instantly set threat score to test each threshold
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onForceThreshold('safe')}
              className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
            >
              <Shield className="w-3 h-3 mr-1" />
              Safe (20%)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onForceThreshold('alert')}
              className="bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Alert (50%)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onForceThreshold('dispatch')}
              className="bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <Siren className="w-3 h-3 mr-1" />
              Dispatch (80%)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onForceThreshold('emergency')}
            >
              <Siren className="w-3 h-3 mr-1" />
              Emergency (95%)
            </Button>
          </div>
        </div>

        {/* Main Simulation Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <Label className="font-medium">Auto Movement</Label>
            <p className="text-xs text-muted-foreground">
              Simulate vehicle moving along route
            </p>
          </div>
          <Button
            variant={isRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={onToggleSimulation}
          >
            {isRunning ? 'Stop' : 'Start'}
          </Button>
        </div>

        {/* Speed Control */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Simulation Speed</Label>
            <span className="text-xs text-muted-foreground">{currentSpeed}x</span>
          </div>
          <Slider
            value={[currentSpeed]}
            onValueChange={(v) => onSpeedChange(v[0])}
            min={0.5}
            max={5}
            step={0.5}
          />
        </div>

        {/* Location Services Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <Label className="font-medium">Location Services</Label>
            <p className="text-xs text-muted-foreground">
              {locationEnabled ? 'Enabled' : 'Disabled (high-risk event)'}
            </p>
          </div>
          <Switch
            checked={locationEnabled}
            onCheckedChange={onToggleLocation}
          />
        </div>

        {/* Deviation Control */}
        <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <Label className="font-medium text-orange-700">Simulate Route Deviation</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[deviationAmount]}
              onValueChange={(v) => setDeviationAmount(v[0])}
              min={50}
              max={1000}
              step={50}
              className="flex-1"
            />
            <span className="text-xs w-16 text-right">{deviationAmount}m</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSimulateDeviation(deviationAmount)}
            className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            Deviate from Route
          </Button>
        </div>

        {/* Suspicious Stop */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSimulateStop}
          className="w-full bg-transparent"
        >
          Simulate Suspicious Stop
        </Button>

        {/* Network Loss */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSimulateNetworkLoss}
          className="w-full bg-transparent"
        >
          Simulate Network Loss
        </Button>

        {/* End Ride */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onEndRide}
          className="w-full"
        >
          End Ride Safely
        </Button>

        {/* Legend */}
        <div className="pt-3 border-t text-xs space-y-1">
          <p className="font-medium text-muted-foreground">Threat Thresholds:</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
              {'<'}40%: Safe
            </span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
              40-70%: Alert
            </span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
              70-90%: Dispatch
            </span>
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
              {'>'}90%: Emergency
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
