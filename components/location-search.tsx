'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Navigation, X } from 'lucide-react';
import { Location } from '@/lib/safety-types';

interface LocationResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface LocationSearchProps {
  label: string;
  placeholder?: string;
  value: Location | null;
  onSelect: (location: Location, displayName: string) => void;
  onClear?: () => void;
  showCurrentLocation?: boolean;
}

export default function LocationSearch({
  label,
  placeholder = 'Search for a location...',
  value,
  onSelect,
  onClear,
  showCurrentLocation = false,
}: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear display when value is cleared externally
  useEffect(() => {
    if (!value) {
      setSelectedDisplay('');
    }
  }, [value]);

  // Search locations using Nominatim API
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=8&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );

      if (!response.ok) throw new Error('Search failed');

      const data: LocationResult[] = await response.json();
      setResults(data);
      setIsOpen(true);
    } catch (error) {
      console.error('Location search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length >= 3) {
      debounceRef.current = setTimeout(() => {
        searchLocations(query);
      }, 300);
    } else {
      setResults([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchLocations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle location selection
  const handleSelect = (result: LocationResult) => {
    const location: Location = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      timestamp: Date.now(),
      source: 'network',
    };

    const shortName = formatShortName(result);
    setSelectedDisplay(shortName);
    setQuery('');
    setIsOpen(false);
    setResults([]);
    onSelect(location, result.display_name);
  };

  // Format short display name
  const formatShortName = (result: LocationResult): string => {
    const parts: string[] = [];
    if (result.address?.road) parts.push(result.address.road);
    if (result.address?.suburb) parts.push(result.address.suburb);
    if (result.address?.city) parts.push(result.address.city);
    if (result.address?.country) parts.push(result.address.country);
    
    if (parts.length === 0) {
      return result.display_name.split(',').slice(0, 2).join(', ');
    }
    return parts.slice(0, 3).join(', ');
  };

  // Detect current location
  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy,
          source: 'gps',
        };

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&addressdetails=1`,
            {
              headers: { 'Accept-Language': 'en' },
            }
          );
          const data = await response.json();
          const displayName = data.display_name || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
          setSelectedDisplay(formatShortName(data));
          onSelect(location, displayName);
        } catch {
          setSelectedDisplay(`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
          onSelect(location, `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
        }

        setIsDetectingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to detect your location. Please search manually.');
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Clear selection
  const handleClear = () => {
    setSelectedDisplay('');
    setQuery('');
    setResults([]);
    onClear?.();
  };

  return (
    <div ref={containerRef} className="relative space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      
      {value ? (
        // Selected location display
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedDisplay || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`}</p>
            <p className="text-xs text-muted-foreground">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
          </div>
          <button
            onClick={handleClear}
            className="p-1 hover:bg-background rounded transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        // Search input
        <div className="relative">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="pl-9 pr-10"
              onFocus={() => results.length > 0 && setIsOpen(true)}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Current location button */}
          {showCurrentLocation && !query && (
            <button
              onClick={detectCurrentLocation}
              disabled={isDetectingLocation}
              className="mt-2 flex items-center gap-2 w-full p-3 text-left text-sm bg-background border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              {isDetectingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Navigation className="h-4 w-4 text-primary" />
              )}
              <span>Use current location</span>
            </button>
          )}

          {/* Results dropdown */}
          {isOpen && results.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
              {results.map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{formatShortName(result)}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.display_name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {isOpen && query.length >= 3 && !isSearching && results.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
              No locations found. Try a different search term.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
