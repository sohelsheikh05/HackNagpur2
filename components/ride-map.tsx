'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Location, Route, HighRiskZone } from '@/lib/safety-types';

declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

interface RideMapProps {
  currentLocation: Location | null;
  confirmedRoute: Route | null;
  alternativeRoutes?: Route[];
  highRiskZones: HighRiskZone[];
  locationHistory: Location[];
  isDeviated: boolean;
  threatLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  onMapReady?: () => void;
}

export default function RideMap({
  currentLocation,
  confirmedRoute,
  alternativeRoutes = [],
  highRiskZones,
  locationHistory,
  isDeviated,
  threatLevel,
  onMapReady,
}: RideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const routesRef = useRef<any>(null);
  const zonesRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeaflet = async () => {
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
        script.onload = () => setIsLoaded(true);
        document.head.appendChild(script);
      } else {
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
  const initMap = useCallback(() => {
    if (!isLoaded || !mapContainerRef.current || !window.L) return;
    
    const L = window.L;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.209],
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    routesRef.current = L.layerGroup().addTo(map);
    zonesRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    
    setTimeout(() => {
      map.invalidateSize();
      onMapReady?.();
    }, 100);
  }, [isLoaded, onMapReady]);

  useEffect(() => {
    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initMap]);

  // Update high-risk zones
  useEffect(() => {
    if (!mapInstanceRef.current || !zonesRef.current || !window.L) return;

    zonesRef.current.clearLayers();

    for (const zone of highRiskZones) {
      const color = zone.riskLevel >= 0.7 ? '#ef4444' : zone.riskLevel >= 0.5 ? '#f97316' : '#eab308';

      L.circle([zone.center.lat, zone.center.lng], {
        radius: zone.radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
      })
        .bindPopup(`<b>High Risk Zone</b><br/>${zone.reason}`)
        .addTo(zonesRef.current!);
    }
  }, [highRiskZones, isLoaded]);

  // Update routes
  useEffect(() => {
    if (!mapInstanceRef.current || !routesRef.current || !window.L) return;

    routesRef.current.clearLayers();

    // Alternative routes
    for (const route of alternativeRoutes) {
      if (route.id === confirmedRoute?.id) continue;
      const latlngs = route.waypoints.map((wp) => [wp.lat, wp.lng] as [number, number]);
      L.polyline(latlngs, {
        color: '#94a3b8',
        weight: 3,
        opacity: 0.5,
        dashArray: '10, 10',
      }).addTo(routesRef.current!);
    }

    // Confirmed route
    if (confirmedRoute) {
      const latlngs = confirmedRoute.waypoints.map((wp) => [wp.lat, wp.lng] as [number, number]);
      const routeColor = isDeviated ? '#ef4444' : '#22c55e';

      L.polyline(latlngs, {
        color: routeColor,
        weight: 5,
        opacity: 0.8,
      })
        .bindPopup(`<b>Confirmed Route</b><br/>Safety: ${(confirmedRoute.safetyScore * 100).toFixed(0)}%`)
        .addTo(routesRef.current!);

      // Safe corridor visualization
      for (const waypoint of confirmedRoute.waypoints) {
        L.circle([waypoint.lat, waypoint.lng], {
          radius: 100,
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.05,
          weight: 0,
        }).addTo(routesRef.current!);
      }
    }

    // Location history trail
    if (locationHistory.length > 1) {
      const historyLatlngs = locationHistory.map((loc) => [loc.lat, loc.lng] as [number, number]);
      L.polyline(historyLatlngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.6,
        dashArray: '5, 5',
      }).addTo(routesRef.current!);
    }
  }, [confirmedRoute, alternativeRoutes, locationHistory, isDeviated, isLoaded]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current || !window.L) return;

    markersRef.current.clearLayers();

    // Current location marker
    if (currentLocation) {
      const threatColors = {
        safe: '#22c55e',
        low: '#84cc16',
        medium: '#eab308',
        high: '#f97316',
        critical: '#ef4444',
      };

      const markerColor = threatColors[threatLevel];
      const pulseStyle = threatLevel === 'critical' ? 'animation: pulse 1s infinite;' : '';

      const icon = L.divIcon({
        className: 'current-location-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background: ${markerColor};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ${pulseStyle}
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([currentLocation.lat, currentLocation.lng], { icon })
        .bindPopup(`<b>Current Location</b><br/>Threat: ${threatLevel.toUpperCase()}`)
        .addTo(markersRef.current!);

      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 14);
    }

    // Source marker
    if (confirmedRoute && confirmedRoute.waypoints.length > 0) {
      const source = confirmedRoute.waypoints[0];
      L.marker([source.lat, source.lng], {
        icon: L.divIcon({
          className: 'source-marker',
          html: `<div style="
            width: 12px;
            height: 12px;
            background: #3b82f6;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
      })
        .bindPopup('<b>Start</b>')
        .addTo(markersRef.current!);

      // Destination marker
      const dest = confirmedRoute.waypoints[confirmedRoute.waypoints.length - 1];
      L.marker([dest.lat, dest.lng], {
        icon: L.divIcon({
          className: 'dest-marker',
          html: `<div style="
            width: 16px;
            height: 16px;
            background: #8b5cf6;
            border: 2px solid white;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      })
        .bindPopup('<b>Destination</b>')
        .addTo(markersRef.current!);
    }
  }, [currentLocation, confirmedRoute, threatLevel, isLoaded]);

  // Add pulse animation CSS
  useEffect(() => {
    const styleId = 'leaflet-pulse-animation';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden bg-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}

      {isDeviated && (
        <div className="absolute top-4 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-20">
          <span className="animate-pulse font-bold">WARNING</span>
          <span className="text-sm">Vehicle deviated from confirmed route</span>
        </div>
      )}
    </div>
  );
}
