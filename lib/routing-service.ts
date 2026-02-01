// OSRM (Open Source Routing Machine) Integration
// Uses the free public OSRM API for real road-based routing

import { Location } from './safety-types';

interface OSRMRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: [number, number][]; // [lng, lat] pairs
  };
}

interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
  waypoints: {
    name: string;
    location: [number, number];
  }[];
}

// Get real road route from OSRM
export async function getRouteFromOSRM(
  source: Location,
  destination: Location,
  alternatives: boolean = true
): Promise<{
  routes: {
    waypoints: Location[];
    distance: number;
    duration: number;
  }[];
}> {
  try {
    // OSRM public API endpoint
    const url = `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=${alternatives}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data: OSRMResponse = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No routes found');
    }

    // Convert OSRM routes to our format
    const routes = data.routes.map((route) => {
      // OSRM returns [lng, lat] pairs, we need to convert to Location objects
      const waypoints: Location[] = route.geometry.coordinates.map(
        ([lng, lat], index) => ({
          lat,
          lng,
          timestamp: Date.now() + (index * (route.duration * 1000)) / route.geometry.coordinates.length,
          source: 'network' as const,
        })
      );

      return {
        waypoints,
        distance: route.distance, // in meters
        duration: route.duration / 60, // convert seconds to minutes
      };
    });

    return { routes };
  } catch (error) {
    console.error('OSRM routing failed:', error);
    // Fallback to straight line if OSRM fails
    return {
      routes: [
        {
          waypoints: [source, destination],
          distance: calculateStraightLineDistance(source, destination),
          duration: calculateStraightLineDistance(source, destination) / 500, // ~30km/h
        },
      ],
    };
  }
}

// Calculate straight line distance between two points (Haversine formula)
export function calculateStraightLineDistance(
  point1: Location,
  point2: Location
): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (point1.lat * Math.PI) / 180;
  const lat2 = (point2.lat * Math.PI) / 180;
  const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Get multiple route alternatives with variations
export async function getRouteAlternatives(
  source: Location,
  destination: Location,
  count: number = 3
): Promise<{
  waypoints: Location[];
  distance: number;
  duration: number;
}[]> {
  const { routes } = await getRouteFromOSRM(source, destination, true);

  // If OSRM returns fewer routes than requested, create variations
  if (routes.length < count) {
    const additionalRoutes = [];
    for (let i = routes.length; i < count; i++) {
      // Create route variation by adding intermediate waypoint
      const midLat = (source.lat + destination.lat) / 2;
      const midLng = (source.lng + destination.lng) / 2;
      const offset = (i - routes.length + 1) * 0.01;

      // Try routing through a slightly offset midpoint
      const viaPoint: Location = {
        lat: midLat + offset * (i % 2 === 0 ? 1 : -1),
        lng: midLng + offset * (i % 2 === 0 ? -1 : 1),
        timestamp: Date.now(),
        source: 'network',
      };

      try {
        // Get route via intermediate point
        const viaUrl = `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${viaPoint.lng},${viaPoint.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const viaResponse = await fetch(viaUrl);
        const viaData: OSRMResponse = await viaResponse.json();

        if (viaData.code === 'Ok' && viaData.routes.length > 0) {
          const route = viaData.routes[0];
          additionalRoutes.push({
            waypoints: route.geometry.coordinates.map(([lng, lat], idx) => ({
              lat,
              lng,
              timestamp: Date.now() + (idx * (route.duration * 1000)) / route.geometry.coordinates.length,
              source: 'network' as const,
            })),
            distance: route.distance,
            duration: route.duration / 60,
          });
        }
      } catch (e) {
        // Skip if via routing fails
      }
    }
    routes.push(...additionalRoutes);
  }

  return routes.slice(0, count);
}
