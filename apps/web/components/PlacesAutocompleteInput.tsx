"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

type PlacesAutocompleteProps = {
  id: string;
  placeholder: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (p: { address: string; lat: number; lng: number }) => void;
};

export function PlacesAutocompleteInput({ id, placeholder, label, value, onChange, onPlaceSelected }: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    function initialize() {
      const w = window as any;
      if (!w.google?.maps?.places) return;
      if (!inputRef.current) return;
      if (autocompleteRef.current) return;

      const autocomplete = new w.google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode", "establishment"],
        fields: ["formatted_address", "geometry"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address && place.geometry?.location) {
          onPlaceSelected({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });

      autocompleteRef.current = autocomplete;
    }
    loadGoogleMaps().then(initialize).catch(() => console.warn("[places] Failed to load Google Maps"));
  }, [onPlaceSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm transition-colors focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
      />
    </label>
  );
}
