"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

type Point = { lat: number; lng: number; address: string };

export type GoogleLocationMapProps = {
  onOriginChange: (point: Point) => void;
  onDestChange: (point: Point) => void;
  externalOrigin?: Point | null;
  externalDest?: Point | null;
  hideDest?: boolean;
  initialCenter?: [number, number];
  autoLocateOrigin?: boolean;
};

export function GoogleLocationMap({
  onOriginChange,
  onDestChange,
  externalOrigin,
  externalDest,
  hideDest,
  initialCenter = [25.7617, -80.1918],
  autoLocateOrigin = false,
}: GoogleLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const originMarker = useRef<any>(null);
  const destMarker = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const selecting = useRef<"origin" | "dest">("origin");
  const originCallback = useRef(onOriginChange);
  const destCallback = useRef(onDestChange);

  useEffect(() => {
    originCallback.current = onOriginChange;
    destCallback.current = onDestChange;
  }, [onOriginChange, onDestChange]);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps().then(() => {
      if (!mounted || !mapRef.current) return;
      map.current = new (window as any).google.maps.Map(mapRef.current, {
        center: { lat: initialCenter[0], lng: initialCenter[1] },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      map.current.addListener("click", (event: any) => {
        if (!event.latLng) return;
        const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        if (selecting.current === "origin") {
          originCallback.current({ ...point, address: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` });
          selecting.current = hideDest ? "origin" : "dest";
        } else {
          destCallback.current({ ...point, address: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` });
        }
      });
      setReady(true);
    }).catch(() => setError("No se pudo cargar Google Maps. Verificá la API key y las APIs habilitadas."));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready || !map.current || !externalOrigin) return;
    originMarker.current?.setMap(null);
    originMarker.current = new (window as any).google.maps.Marker({ position: externalOrigin, map: map.current, label: "A" });
    map.current.panTo(externalOrigin);
    map.current.setZoom(15);
    selecting.current = hideDest ? "origin" : "dest";
  }, [ready, externalOrigin, hideDest]);

  useEffect(() => {
    if (!ready || !map.current || !externalDest) return;
    destMarker.current?.setMap(null);
    destMarker.current = new (window as any).google.maps.Marker({ position: externalDest, map: map.current, label: "B" });
    map.current.panTo(externalDest);
  }, [ready, externalDest]);

  useEffect(() => {
    if (!autoLocateOrigin || externalOrigin || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      originCallback.current({ lat: coords.latitude, lng: coords.longitude, address: "Mi ubicación actual" });
    });
  }, [autoLocateOrigin, externalOrigin, onOriginChange]);

  return (
    <div className="space-y-3">
      <div ref={mapRef} className="h-[400px] w-full overflow-hidden rounded-xl border shadow-sm" />
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{!externalOrigin ? "Elegí el origen en el mapa" : !hideDest && !externalDest ? "Elegí el destino" : "Ubicaciones seleccionadas"}</span>
        <button onClick={() => { selecting.current = "origin"; }} className="font-medium text-gray-700 hover:text-black">Cambiar origen</button>
      </div>
    </div>
  );
}
