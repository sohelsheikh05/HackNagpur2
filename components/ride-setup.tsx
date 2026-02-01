'use client';

import { useState } from 'react';
import { Route, VehicleInfo, Location, EmergencyContact } from '@/lib/safety-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, ArrowRight, Shield, Clock, AlertTriangle, CheckCircle2, Loader2, Plus, Trash2, Mail, Phone, User } from 'lucide-react';
import LocationSearch from '@/components/location-search';
import RoutePreviewMap from '@/components/route-preview-map';

interface RideSetupProps {
  onRideCreated: (sessionId: string, routes: Route[], selectedRoute: Route, contacts: EmergencyContact[]) => void;
  isLoading: boolean;
}

export default function RideSetup({ onRideCreated, isLoading }: RideSetupProps) {
  const [step, setStep] = useState<'location' | 'vehicle' | 'contacts' | 'route' | 'confirm'>('location');
  const [source, setSource] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [sourceDisplay, setSourceDisplay] = useState('');
  const [destinationDisplay, setDestinationDisplay] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    licensePlate: '',
    driverName: '',
    vehicleModel: '',
    vehicleColor: '',
  });
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [creating, setCreating] = useState(false);
  
  // Emergency contacts
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { id: 'ec-1', name: '', phone: '', email: '', relationship: '', notified: false },
  ]);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', relationship: '' });

  // Handle source selection
  const handleSourceSelect = (location: Location, displayName: string) => {
    setSource(location);
    setSourceDisplay(displayName.split(',').slice(0, 2).join(', '));
  };

  // Handle destination selection
  const handleDestinationSelect = (location: Location, displayName: string) => {
    setDestination(location);
    setDestinationDisplay(displayName.split(',').slice(0, 2).join(', '));
  };

  // Create ride session and get route options
  const createRideSession = async () => {
    if (!source || !destination) {
      setError('Please select both pickup and drop-off locations');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          source,
          destination,
          vehicleInfo: vehicleInfo.licensePlate ? vehicleInfo : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create ride');
      }

      setRoutes(data.routes);
      setSelectedRouteId(data.routes[0]?.id || '');
      setStep('route');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ride');
    } finally {
      setCreating(false);
    }
  };

  // Move to confirmation step
  const proceedToConfirm = () => {
    const selectedRoute = routes.find((r) => r.id === selectedRouteId);
    if (!selectedRoute) {
      setError('Please select a route');
      return;
    }
    setStep('confirm');
  };

  // Confirm selected route and start monitoring
  const confirmRoute = async () => {
    const selectedRoute = routes.find((r) => r.id === selectedRouteId);
    if (!selectedRoute) {
      setError('Please select a route');
      return;
    }

    setCreating(true);

    try {
      const response = await fetch('/api/ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          source,
          destination,
          vehicleInfo: vehicleInfo.licensePlate ? vehicleInfo : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to confirm route');
      }

      // Filter out empty contacts
      const validContacts = emergencyContacts.filter(c => c.name && c.email);
      onRideCreated(data.sessionId, data.routes, selectedRoute, validContacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm route');
    } finally {
      setCreating(false);
    }
  };

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  // Step indicators
  const steps = [
    { id: 'location', label: 'Location', number: 1 },
    { id: 'vehicle', label: 'Vehicle', number: 2 },
    { id: 'contacts', label: 'Contacts', number: 3 },
    { id: 'route', label: 'Route', number: 4 },
    { id: 'confirm', label: 'Confirm', number: 5 },
  ];
  
  // Emergency contact helpers
  const addContact = () => {
    if (emergencyContacts.length >= 5) return;
    setEmergencyContacts([
      ...emergencyContacts,
      { id: `ec-${Date.now()}`, name: '', phone: '', email: '', relationship: '', notified: false },
    ]);
  };
  
  const removeContact = (id: string) => {
    if (emergencyContacts.length <= 1) return;
    setEmergencyContacts(emergencyContacts.filter(c => c.id !== id));
  };
  
  const updateContact = (id: string, field: keyof EmergencyContact, value: string) => {
    setEmergencyContacts(emergencyContacts.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };
  
  const hasValidContacts = emergencyContacts.some(c => c.name && c.email);

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex items-center justify-between">
        {steps.map((s, index) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                index < currentStepIndex
                  ? 'bg-primary text-primary-foreground'
                  : index === currentStepIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index < currentStepIndex ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                s.number
              )}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:block ${
                index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-0.5 mx-2 ${
                  index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {step === 'location' && 'Enter Locations'}
            {step === 'vehicle' && 'Vehicle Details'}
            {step === 'contacts' && 'Emergency Contacts'}
            {step === 'route' && 'Select Route'}
            {step === 'confirm' && 'Confirm Your Route'}
          </CardTitle>
          <CardDescription>
            {step === 'location' && 'Search for your pickup and drop-off locations worldwide'}
            {step === 'vehicle' && 'Add cab details for safety tracking (optional)'}
            {step === 'contacts' && 'Add contacts who will receive alerts if an emergency is detected'}
            {step === 'route' && 'Choose the route your cab will take'}
            {step === 'confirm' && 'Review and confirm the route before starting your ride'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Location */}
          {step === 'location' && (
            <div className="space-y-6">
              <LocationSearch
                label="Pickup Location"
                placeholder="Search pickup address..."
                value={source}
                onSelect={handleSourceSelect}
                onClear={() => {
                  setSource(null);
                  setSourceDisplay('');
                }}
                showCurrentLocation
              />

              <LocationSearch
                label="Drop-off Location"
                placeholder="Search destination address..."
                value={destination}
                onSelect={handleDestinationSelect}
                onClear={() => {
                  setDestination(null);
                  setDestinationDisplay('');
                }}
              />

              {/* Map Preview */}
              {(source || destination) && (
                <div className="h-[300px] w-full">
                  <RoutePreviewMap
                    source={source}
                    destination={destination}
                    routes={[]}
                    selectedRouteId=""
                  />
                </div>
              )}

              <div className="pt-4">
                <Button
                  onClick={() => {
                    setStep('vehicle');
                  }}
                  disabled={!source || !destination}
                  className="w-full"
                  size="lg"
                >
                  Continue to Vehicle Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Vehicle Info */}
          {step === 'vehicle' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                Vehicle details help us verify your ride and assist emergency services if needed.
                This step is optional but recommended.
              </div>

              <div className="space-y-2">
                <Label htmlFor="licensePlate">License Plate Number</Label>
                <Input
                  id="licensePlate"
                  placeholder="e.g., ABC 1234"
                  value={vehicleInfo.licensePlate}
                  onChange={(e) =>
                    setVehicleInfo({ ...vehicleInfo, licensePlate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverName">Driver Name</Label>
                <Input
                  id="driverName"
                  placeholder="As shown in your ride-share app"
                  value={vehicleInfo.driverName}
                  onChange={(e) =>
                    setVehicleInfo({ ...vehicleInfo, driverName: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleModel">Vehicle Model</Label>
                  <Input
                    id="vehicleModel"
                    placeholder="e.g., Toyota Camry"
                    value={vehicleInfo.vehicleModel}
                    onChange={(e) =>
                      setVehicleInfo({ ...vehicleInfo, vehicleModel: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleColor">Vehicle Color</Label>
                  <Input
                    id="vehicleColor"
                    placeholder="e.g., White"
                    value={vehicleInfo.vehicleColor}
                    onChange={(e) =>
                      setVehicleInfo({ ...vehicleInfo, vehicleColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('location')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep('contacts')}
                  className="flex-1"
                >
                  Continue to Emergency Contacts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Emergency Contacts */}
          {step === 'contacts' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <strong>Important:</strong> These contacts will receive automatic email alerts with your location if the system detects a potential safety threat. At least one contact with a valid email is required.
              </div>

              <div className="space-y-4">
                {emergencyContacts.map((contact, index) => (
                  <div key={contact.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Contact {index + 1}</span>
                      {emergencyContacts.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeContact(contact.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`name-${contact.id}`} className="text-xs">Name *</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`name-${contact.id}`}
                            placeholder="Contact name"
                            value={contact.name}
                            onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label htmlFor={`relationship-${contact.id}`} className="text-xs">Relationship</Label>
                        <Input
                          id={`relationship-${contact.id}`}
                          placeholder="e.g., Mother, Friend"
                          value={contact.relationship}
                          onChange={(e) => updateContact(contact.id, 'relationship', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor={`email-${contact.id}`} className="text-xs">Email Address *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`email-${contact.id}`}
                          type="email"
                          placeholder="email@example.com"
                          value={contact.email}
                          onChange={(e) => updateContact(contact.id, 'email', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor={`phone-${contact.id}`} className="text-xs">Phone Number (optional)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`phone-${contact.id}`}
                          placeholder="+91-9876543210"
                          value={contact.phone}
                          onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {emergencyContacts.length < 5 && (
                <Button
                  variant="outline"
                  onClick={addContact}
                  className="w-full bg-transparent"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Contact
                </Button>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('vehicle')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={createRideSession}
                  disabled={creating || !hasValidContacts}
                  className="flex-1"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finding Routes...
                    </>
                  ) : (
                    <>
                      Find Safe Routes
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              
              {!hasValidContacts && (
                <p className="text-xs text-red-600 text-center">Please add at least one contact with name and email</p>
              )}
            </div>
          )}

          {/* Step 4: Route Selection */}
          {step === 'route' && routes.length > 0 && (
            <div className="space-y-4">
              {/* Map with routes */}
              <div className="h-[300px]">
                <RoutePreviewMap
                  source={source}
                  destination={destination}
                  routes={routes}
                  selectedRouteId={selectedRouteId}
                  onRouteSelect={setSelectedRouteId}
                />
              </div>

              {/* Route options */}
              <RadioGroup
                value={selectedRouteId}
                onValueChange={setSelectedRouteId}
                className="space-y-3"
              >
                {routes.map((route, index) => (
                  <div
                    key={route.id}
                    className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedRouteId === route.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setSelectedRouteId(route.id)}
                  >
                    <RadioGroupItem value={route.id} id={route.id} className="mt-1" />
                    <Label htmlFor={route.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          Route {index + 1}
                          {index === 0 && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Safest
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-sm font-semibold px-2 py-0.5 rounded ${
                            route.safetyScore >= 0.8
                              ? 'bg-green-100 text-green-700'
                              : route.safetyScore >= 0.6
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {(route.safetyScore * 100).toFixed(0)}% Safe
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {(route.distance / 1000).toFixed(1)} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {Math.round(route.estimatedDuration)} min
                        </span>
                        {route.highRiskZones.length > 0 && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <AlertTriangle className="h-4 w-4" />
                            {route.highRiskZones.length} risk zone(s)
                          </span>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('contacts')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={proceedToConfirm}
                  disabled={!selectedRouteId}
                  className="flex-1"
                >
                  Review Route
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 'confirm' && selectedRoute && (
            <div className="space-y-6">
              {/* Route confirmation map */}
              <div className="h-[300px]">
                <RoutePreviewMap
                  source={source}
                  destination={destination}
                  routes={[selectedRoute]}
                  selectedRouteId={selectedRouteId}
                />
              </div>

              {/* Trip Summary */}
              <div className="space-y-4">
                <h3 className="font-semibold">Trip Summary</h3>
                
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="text-sm font-medium">{sourceDisplay}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Drop-off</p>
                      <p className="text-sm font-medium">{destinationDisplay}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">{(selectedRoute.distance / 1000).toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">km</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">{Math.round(selectedRoute.estimatedDuration)}</p>
                    <p className="text-xs text-muted-foreground">minutes</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-lg font-semibold ${
                      selectedRoute.safetyScore >= 0.8 ? 'text-green-600' :
                      selectedRoute.safetyScore >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(selectedRoute.safetyScore * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">safety</p>
                  </div>
                </div>

                {vehicleInfo.licensePlate && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Vehicle Details</p>
                    <p className="text-sm font-medium">
                      {vehicleInfo.vehicleColor} {vehicleInfo.vehicleModel} - {vehicleInfo.licensePlate}
                    </p>
                    {vehicleInfo.driverName && (
                      <p className="text-sm text-muted-foreground">Driver: {vehicleInfo.driverName}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Important Safety Notice</p>
                    <p className="text-sm text-amber-700 mt-1">
                      This route becomes your safety baseline. Our system will monitor your ride 
                      and automatically alert emergency contacts if suspicious deviations are detected.
                      Make sure this is the exact route your cab will take.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('route')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Change Route
                </Button>
                <Button
                  onClick={confirmRoute}
                  disabled={isLoading || creating}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirm Route & Start Ride
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
