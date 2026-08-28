"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import {
  categoryMeta,
  distanceRings,
  eventRoutes,
  mobiArea,
  outsideMobiArea,
  Spot,
  spots,
  tsubaki,
} from "@/lib/guam-trip-data";

type GuamMapProps = {
  selectedSpotId: number;
  activeRouteId: string | null;
  onSelectSpot: (id: number) => void;
};

function iconForSpot(spot: Spot) {
  const color = categoryMeta[spot.category].color;

  return L.divIcon({
    className: "guam-number-marker",
    html: `<span style="background:${color};">${spot.label}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  });
}

function popupHtml(spot: Spot) {
  const status = spot.confidence === "confirmed" ? "確定" : "要確認";
  const category = categoryMeta[spot.category].name;

  return `
    <div class="guam-popup">
      <div class="popup-title">${spot.label} ${spot.name}</div>
      <div class="popup-meta">${category} / ${status}</div>
      <div class="popup-line">推奨: ${spot.recommended}</div>
      <div class="popup-line">${spot.notes}</div>
    </div>
  `;
}

function distanceMeters(a: Spot, b: Spot) {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dLat = (a.lat - b.lat) * metersPerLat;
  const dLng = (a.lng - b.lng) * metersPerLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function offsetLatLng(lat: number, lng: number, angleDeg: number, meters: number) {
  const angle = angleDeg * (Math.PI / 180);
  const dLat = (Math.sin(angle) * meters) / 111_320;
  const dLng = (Math.cos(angle) * meters) / (111_320 * Math.cos(lat * (Math.PI / 180)));
  return { lat: lat + dLat, lng: lng + dLng };
}

function buildDisplayPositions() {
  const closeMeters = 130;
  const visited = new Set<number>();
  const positions = new Map<number, { lat: number; lng: number; offset: boolean }>();

  spots.forEach((spot) => {
    if (visited.has(spot.id)) return;

    const group: Spot[] = [];
    const queue = [spot];
    visited.add(spot.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      group.push(current);

      spots.forEach((candidate) => {
        if (visited.has(candidate.id)) return;
        if (distanceMeters(current, candidate) > closeMeters) return;
        visited.add(candidate.id);
        queue.push(candidate);
      });
    }

    if (group.length === 1) {
      positions.set(spot.id, { lat: spot.lat, lng: spot.lng, offset: false });
      return;
    }

    const sorted = [...group].sort((a, b) => a.id - b.id);
    const radius = sorted.length <= 2 ? 34 : sorted.length <= 4 ? 42 : 54;
    sorted.forEach((item, index) => {
      const angle = -90 + (360 / sorted.length) * index;
      positions.set(item.id, { ...offsetLatLng(item.lat, item.lng, angle, radius), offset: true });
    });
  });

  return positions;
}

export function GuamMap({ selectedSpotId, activeRouteId, onSelectSpot }: GuamMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());
  const actualRefs = useRef<Map<number, L.LatLng>>(new Map());
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const containerId = useMemo(() => "guam-trip-map", []);

  useEffect(() => {
    if (mapRef.current) return;

    const markers = markerRefs.current;
    const actualPositions = actualRefs.current;
    const map = L.map(containerId, {
      center: [tsubaki.lat, tsubaki.lng],
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://tile.openstreetmap.jp/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.polygon(mobiArea, {
      color: "#16a34a",
      fillColor: "#22c55e",
      fillOpacity: 0.14,
      weight: 2,
    })
      .bindPopup("mobi利用可能エリアの推定表示。実際の利用可否は現地アプリで確認。")
      .addTo(map);

    L.polygon(outsideMobiArea, {
      color: "#ef4444",
      fillColor: "#ef4444",
      fillOpacity: 0.12,
      weight: 2,
      dashArray: "8 8",
    })
      .bindPopup("恋人岬方面はmobi圏外候補。実際の利用可否は現地アプリで確認。")
      .addTo(map);

    distanceRings.forEach((ring) => {
      L.circle([tsubaki.lat, tsubaki.lng], {
        radius: ring.meters,
        color: ring.color,
        fillOpacity: 0,
        weight: 2,
      })
        .bindPopup(`<strong>${ring.label}</strong><br>${ring.description}`)
        .addTo(map);
    });

    const displayPositions = buildDisplayPositions();
    const offsetLineGroup = L.layerGroup().addTo(map);

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 36,
      disableClusteringAtZoom: 16,
    });

    spots.forEach((spot) => {
      const display = displayPositions.get(spot.id) ?? { lat: spot.lat, lng: spot.lng, offset: false };
      const actualLatLng = L.latLng(spot.lat, spot.lng);
      actualPositions.set(spot.id, actualLatLng);

      if (display.offset) {
        L.polyline([L.latLng(display.lat, display.lng), actualLatLng], {
          color: categoryMeta[spot.category].color,
          opacity: 0.45,
          weight: 2,
          dashArray: "4 5",
          interactive: false,
        }).addTo(offsetLineGroup);
        L.circleMarker(actualLatLng, {
          radius: 3,
          color: categoryMeta[spot.category].color,
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 2,
          interactive: false,
        }).addTo(offsetLineGroup);
      }

      const marker = L.marker([display.lat, display.lng], {
        icon: iconForSpot(spot),
        title: `${spot.label} ${spot.name}`,
      })
        .bindPopup(popupHtml(spot))
        .bindTooltip(spot.shortName, {
          permanent: true,
          direction: "right",
          offset: [16, 0],
          className: "guam-pin-label",
        });

      marker.on("click", () => onSelectSpot(spot.id));
      markers.set(spot.id, marker);
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
      actualPositions.clear();
      routeLayerRef.current = null;
    };
  }, [containerId, onSelectSpot]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRefs.current.get(selectedSpotId);
    if (!map || !marker) return;

    const latLng = marker.getLatLng();
    const targetZoom = Math.max(map.getZoom(), 17);

    map.setView(latLng, targetZoom, { animate: true });
  }, [selectedSpotId]);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    routeLayer.clearLayers();
    const route = eventRoutes.find((item) => item.id === activeRouteId);
    if (!route) return;

    const stopPoints = route.spotIds
      .map((spotId) => actualRefs.current.get(spotId))
      .filter((point): point is L.LatLng => Boolean(point));
    const pathPoints =
      route.path && route.path.length >= 2
        ? route.path.map(([lat, lng]) => L.latLng(lat, lng))
        : stopPoints;
    if (pathPoints.length < 2 || stopPoints.length < 2) return;

    L.polyline(pathPoints, {
      color: route.color,
      opacity: 0.9,
      weight: 5,
      lineCap: "round",
      lineJoin: "round",
    })
      .bindTooltip(route.label, { sticky: true })
      .addTo(routeLayer);

    stopPoints.forEach((point, index) => {
      L.circleMarker(point, {
        radius: 10,
        color: "#ffffff",
        fillColor: route.color,
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip(`${index + 1}`)
        .addTo(routeLayer);
    });

    map.fitBounds(L.latLngBounds(pathPoints), { animate: true, padding: [28, 28] });
  }, [activeRouteId]);

  return <div id={containerId} className="h-full min-h-[58vh] w-full" />;
}
