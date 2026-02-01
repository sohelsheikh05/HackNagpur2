'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Location, Route } from '@/lib/safety-types';

declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

interface RoutePreviewMapProps {
  source: Location | null;
  destination: Location | null;
  routes: Route[];
  selectedRouteId: string;
  onRouteSelect?: (routeId: string) => void;
}

export default function RoutePreviewMap({
  source,
  destination,
  routes,
  selectedRouteId,
  onRouteSelect,
}: RoutePreviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const routesRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeaflet = async () => {
      // Check if already loaded
      if (window.L) {
        setIsLoaded(true);
        return;
      }

      // Load CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Load JS
      if (!document.querySelector('script[src*="leaflet.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          setIsLoaded(true);
        };
        document.head.appendChild(script);
      } else {
        // Script exists, wait for it to load
        const checkLoaded = setInterval(() => {
          if (window.L) {
            clearInterval(checkLoaded);
            setIsLoaded(true);
          }
        }, 100);
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || !window.L) return;

    const L = window.L;

    // Clean up existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter: [number, number] = source
      ? [source.lat, source.lng]
      : [20.5937, 78.9629]; // Center of India

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: source ? 13 : 5,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    routesRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Force resize after a short delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isLoaded, source]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current || !window.L) return;

    const L = window.L;
    markersRef.current.clearLayers();

    // Source marker (green)
    if (source) {
      const sourceIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([source.lat, source.lng], { icon: sourceIcon })
        .bindPopup('<strong>Pickup Location</strong>')
        .addTo(markersRef.current);
    }

    // Destination marker (red)
    if (destination) {
      const destIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background: #ef4444;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([destination.lat, destination.lng], { icon: destIcon })
        .bindPopup('<strong>Drop-off Location</strong>')
        .addTo(markersRef.current);
    }

    // Fit bounds
    if (source && destination) {
      const bounds = L.latLngBounds(
        [source.lat, source.lng],
        [destination.lat, destination.lng]
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    } else if (source) {
      mapInstanceRef.current.setView([source.lat, source.lng], 14);
    } else if (destination) {
      mapInstanceRef.current.setView([destination.lat, destination.lng], 14);
    }

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 50);
  }, [source, destination, isLoaded]);

  // Update routes
  useEffect(() => {
    if (!mapInstanceRef.current || !routesRef.current || !window.L) return;

    const L = window.L;
    routesRef.current.clearLayers();

    if (routes.length === 0) return;

    // Draw all routes
    routes.forEach((route, index) => {
      const isSelected = route.id === selectedRouteId;
      
      // Convert waypoints to LatLng array
      const latlngs: [number, number][] = route.waypoints.map((wp) => [wp.lat, wp.lng]);

      // Determine color based on safety score and selection
      let color = '#6b7280'; // gray for unselected
      let weight = 4;
      let opacity = 0.5;

      if (isSelected) {
        weight = 6;
        opacity = 1;
        if (route.safetyScore >= 0.8) {
          color = '#22c55e'; // green
        } else if (route.safetyScore >= 0.6) {
          color = '#eab308'; // yellow
        } else {
          color = '#ef4444'; // red
        }
      } else if (index === 0 && !selectedRouteId) {
        color = '#22c55e';
        opacity = 0.7;
      }

      // Draw route outline for better visibility
      if (isSelected) {
        L.polyline(latlngs, {
          color: '#ffffff',
          weight: weight + 4,
          opacity: 0.8,
        }).addTo(routesRef.current);
      }

      // Draw the route
      const polyline = L.polyline(latlngs, {
        color,
        weight,
        opacity,
        lineJoin: 'round',
        lineCap: 'round',
      });

      if (onRouteSelect) {
        polyline.on('click', () => onRouteSelect(route.id));
        polyline.setStyle({ cursor: 'pointer' });
        
        // Add tooltip with route info
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.estimatedDuration);
        polyline.bindTooltip(
          `<strong>Route ${index + 1}</strong><br/>
           ${distanceKm} km • ${durationMin} min<br/>
           Safety: ${(route.safetyScore * 100).toFixed(0)}%`,
          { sticky: true, className: 'route-tooltip' }
        );
      }

      polyline.addTo(routesRef.current);
    });

    // Fit bounds to show all routes
    if (routes.length > 0 && routes[0].waypoints.length > 0) {
      const allPoints: [number, number][] = [];
      routes.forEach((route) => {
        route.waypoints.forEach((wp) => {
          allPoints.push([wp.lat, wp.lng]);
        });
      });
      
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [routes, selectedRouteId, onRouteSelect, isLoaded]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[250px] rounded-lg overflow-hidden border bg-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1.5 shadow-lg z-20">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow" />
          <span>Pickup</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
          <span>Drop-off</span>
        </div>
        {routes.length > 0 && (
          <div className="border-t pt-1.5 mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-green-500 rounded" />
              <span>Safe route</span>
            </div>
          </div>
        )}
      </div>

      {/* Route info badge */}
      {routes.length > 0 && selectedRouteId && (
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 text-xs shadow-lg z-20">
          {(() => {
            const route = routes.find(r => r.id === selectedRouteId);
            if (!route) return null;
            return (
              <div className="space-y-1">
                <div className="font-medium">Selected Route</div>
                <div className="text-muted-foreground">
                  {(route.distance / 1000).toFixed(1)} km • {Math.round(route.estimatedDuration)} min
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Add custom styles for tooltips */}
      <style jsx global>{`
        .route-tooltip {
          background: white;
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          font-size: 12px;
        }
        .route-tooltip::before {
          border-top-color: white;
        }
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
