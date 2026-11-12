"use client";
import { useSyncExternalStore } from "react";

type Connection = EventTarget & { saveData?: boolean };
const connection = () =>
  (navigator as Navigator & { connection?: Connection }).connection;
const motion = () => window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribeMotion = (callback: () => void) => {
  const preference = motion();
  preference.addEventListener("change", callback);
  return () => preference.removeEventListener("change", callback);
};
const subscribeData = (callback: () => void) => {
  const network = connection();
  network?.addEventListener("change", callback);
  return () => network?.removeEventListener("change", callback);
};
const serverPreference = () => false;

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => motion().matches,
    serverPreference,
  );
}
export function useSaveData() {
  return useSyncExternalStore(
    subscribeData,
    () => Boolean(connection()?.saveData),
    serverPreference,
  );
}
