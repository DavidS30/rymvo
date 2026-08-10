import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let googleMapsPromise: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (googleMapsPromise) return googleMapsPromise;
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key || key === "placeholder") return Promise.reject(new Error("Google Maps key missing"));
  setOptions({ key, v: "weekly" });
  googleMapsPromise = Promise.all([importLibrary("maps"), importLibrary("places")]).then(() => (globalThis as any).google);
  return googleMapsPromise;
}
