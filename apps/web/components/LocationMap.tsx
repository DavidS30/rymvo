"use client";

import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Point = { lat: number; lng: number; address: string };

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function FlyToPoint({ point, clear }: { point?: Point | null; clear: number }) {
  const map = useMap();
  useEffect(() => {
    if (point && point.lat !== 0 && point.lng !== 0) {
      map.flyTo([point.lat, point.lng], map.getZoom() < 14 ? 15 : map.getZoom(), { duration: 1 });
    }
  }, [point?.lat, point?.lng, clear, map]);
  return null;
}

function reverseGeocode(lat: number, lng: number): Promise<string> {
  return fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`)
    .then((r) => r.json())
    .then((d) => d.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    .catch(() => `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}

type Props = {
  onOriginChange: (p: Point) => void;
  onDestChange: (p: Point) => void;
  initialCenter?: [number, number];
  hideDest?: boolean;
  externalOrigin?: Point | null;
  externalDest?: Point | null;
  autoLocateOrigin?: boolean;
};

export type LocationMapProps = Props;

export function LocationMap({
  onOriginChange,
  onDestChange,
  initialCenter = [25.7617, -80.1918],
  hideDest,
  externalOrigin,
  externalDest,
  autoLocateOrigin = false,
}: Props) {
  const [originMarker, setOriginMarker] = useState<Point | null>(null);
  const [destMarker, setDestMarker] = useState<Point | null>(null);
  const [loadingOrigin, setLoadingOrigin] = useState(false);
  const [loadingDest, setLoadingDest] = useState(false);
  const [selecting, setSelecting] = useState<"origin" | "dest" | null>(null);

  useEffect(() => {
    if (!autoLocateOrigin || externalOrigin || originMarker || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      setLoadingOrigin(true);
      const address = await reverseGeocode(coords.latitude, coords.longitude);
      const point = { lat: coords.latitude, lng: coords.longitude, address };
      setOriginMarker(point);
      onOriginChange(point);
      setLoadingOrigin(false);
    });
  }, [autoLocateOrigin, externalOrigin, originMarker, onOriginChange]);

  // Sync external origin -> markers
  useEffect(() => {
    if (externalOrigin && externalOrigin.lat !== 0 && externalOrigin.lng !== 0) {
      setOriginMarker({ lat: externalOrigin.lat, lng: externalOrigin.lng, address: externalOrigin.address });
    }
  }, [externalOrigin?.lat, externalOrigin?.lng]);

  useEffect(() => {
    if (externalDest && externalDest.lat !== 0 && externalDest.lng !== 0) {
      setDestMarker({ lat: externalDest.lat, lng: externalDest.lng, address: externalDest.address });
    }
  }, [externalDest?.lat, externalDest?.lng]);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (selecting === "origin" || (!originMarker && !selecting)) {
        setLoadingOrigin(true);
        const addr = await reverseGeocode(lat, lng);
        const p = { lat, lng, address: addr };
        setOriginMarker(p);
        onOriginChange(p);
        setLoadingOrigin(false);
        setSelecting(null);
      } else if (!hideDest && (selecting === "dest" || (!destMarker && !selecting))) {
        setLoadingDest(true);
        const addr = await reverseGeocode(lat, lng);
        const p = { lat, lng, address: addr };
        setDestMarker(p);
        onDestChange(p);
        setLoadingDest(false);
        setSelecting(null);
      }
    },
    [originMarker, destMarker, hideDest, onOriginChange, onDestChange, selecting]
  );

  const handleClear = () => {
    setOriginMarker(null);
    setDestMarker(null);
  };

  const polylinePositions =
    originMarker && destMarker
      ? [[originMarker.lat, originMarker.lng], [destMarker.lat, destMarker.lng]] as [number, number][]
      : undefined;

  const recenterKey = (originMarker ? 1 : 0) + (destMarker ? 2 : 0);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border shadow-sm">
        <MapContainer
          center={initialCenter}
          zoom={12}
          className="h-[280px] w-full sm:h-[400px]"
          scrollWheelZoom={true}
          style={{ height: "var(--rymvo-map-height, 280px)", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <FlyToPoint point={externalOrigin ?? originMarker} clear={recenterKey} />
          {originMarker && <Marker position={[originMarker.lat, originMarker.lng]} icon={redIcon} />}
          {destMarker && <Marker position={[destMarker.lat, destMarker.lng]} icon={blueIcon} />}
          {polylinePositions && <Polyline positions={polylinePositions} color="#3b82f6" weight={3} />}
        </MapContainer>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs text-gray-400">
          {!originMarker
            ? "Obteniendo tu ubicación o elegí un punto en el mapa"
            : !hideDest && !destMarker
              ? "Ahora elegí el destino"
              : "Podés ajustar cualquiera de los puntos"}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {originMarker && <button onClick={() => setSelecting("origin")} className="text-xs font-medium text-gray-600 hover:text-black">Cambiar origen</button>}
          {!hideDest && destMarker && <button onClick={() => setSelecting("dest")} className="text-xs font-medium text-gray-600 hover:text-black">Cambiar destino</button>}
        {(originMarker || destMarker) && (
          <button onClick={handleClear} className="text-xs font-medium text-red-500 hover:text-red-700">
            Limpiar marcadores
          </button>
        )}
        </div>
      </div>

      {originMarker && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm">
          <div className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full bg-red-500" />
          <div>
            <span className="font-medium text-red-800">Origen:</span>{" "}
            {loadingOrigin ? "Buscando dirección..." : originMarker.address}
          </div>
        </div>
      )}

      {destMarker && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm">
          <div className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full bg-blue-500" />
          <div>
            <span className="font-medium text-blue-800">Destino:</span>{" "}
            {loadingDest ? "Buscando dirección..." : destMarker.address}
          </div>
        </div>
      )}
    </div>
  );
}
