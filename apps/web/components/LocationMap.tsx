"use client";

import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline } from "react-leaflet";
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

type Point = { lat: number; lng: number; label: string };

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function reverseGeocode(lat: number, lng: number): Promise<string> {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
  )
    .then((r) => r.json())
    .then((d) => d.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    .catch(() => `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}

type Props = {
  onOriginChange: (p: { lat: number; lng: number; address: string }) => void;
  onDestChange: (p: { lat: number; lng: number; address: string }) => void;
  initialCenter?: [number, number];
  hideDest?: boolean;
};

export type LocationMapProps = Props;

export function LocationMap({ onOriginChange, onDestChange, initialCenter = [25.7617, -80.1918], hideDest }: Props) {
  const [originMarker, setOriginMarker] = useState<Point | null>(null);
  const [destMarker, setDestMarker] = useState<Point | null>(null);
  const [loadingOrigin, setLoadingOrigin] = useState(false);
  const [loadingDest, setLoadingDest] = useState(false);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!originMarker) {
        setLoadingOrigin(true);
        setOriginMarker({ lat, lng, label: "Origen" });
        const addr = await reverseGeocode(lat, lng);
        onOriginChange({ lat, lng, address: addr });
        setLoadingOrigin(false);
      } else if (!hideDest && !destMarker) {
        setLoadingDest(true);
        setDestMarker({ lat, lng, label: "Destino" });
        const addr = await reverseGeocode(lat, lng);
        onDestChange({ lat, lng, address: addr });
        setLoadingDest(false);
      }
    },
    [originMarker, destMarker, hideDest, onOriginChange, onDestChange]
  );

  const handleClear = () => {
    setOriginMarker(null);
    setDestMarker(null);
  };

  const polylinePositions =
    originMarker && destMarker
      ? [[originMarker.lat, originMarker.lng], [destMarker.lat, destMarker.lng]]
      : undefined;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border shadow-sm">
        <MapContainer
          center={initialCenter}
          zoom={12}
          className="h-[400px] w-full"
          scrollWheelZoom={true}
          style={{ height: "400px", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          {originMarker && <Marker position={[originMarker.lat, originMarker.lng]} icon={redIcon} />}
          {destMarker && <Marker position={[destMarker.lat, destMarker.lng]} icon={blueIcon} />}
          {polylinePositions && <Polyline positions={polylinePositions as [number, number][]} color="#3b82f6" weight={3} />}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {!originMarker
            ? "Hacé clic en el mapa para marcar el origen"
            : !hideDest && !destMarker
              ? "Ahora hacé clic para marcar el destino"
              : `${hideDest ? "Origen seleccionado" : "Ambos puntos seleccionados"} — podés hacer zoom y arrastrar`}
        </div>
        {(originMarker || destMarker) && (
          <button onClick={handleClear} className="text-xs font-medium text-red-500 hover:text-red-700">
            Limpiar marcadores
          </button>
        )}
      </div>

      {originMarker && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm">
          <div className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full bg-red-500" />
          <div>
            <span className="font-medium text-red-800">Origen:</span>{" "}
            {loadingOrigin ? "Buscando dirección..." : originMarker.label === "Origen" ? originMarker.label : `${originMarker.lat.toFixed(5)}, ${originMarker.lng.toFixed(5)}`}
          </div>
        </div>
      )}

      {destMarker && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm">
          <div className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full bg-blue-500" />
          <div>
            <span className="font-medium text-blue-800">Destino:</span>{" "}
            {loadingDest ? "Buscando dirección..." : `${destMarker.lat.toFixed(5)}, ${destMarker.lng.toFixed(5)}`}
          </div>
        </div>
      )}
    </div>
  );
}
