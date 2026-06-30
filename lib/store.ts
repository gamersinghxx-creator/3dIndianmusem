"use client";
import { create } from "zustand";
import type { Artwork } from "./data/types";

export type AxisFilter = "all" | "world" | "india";

/** Lightweight in-app reading panel (replaces external Wikipedia redirects). */
export interface InfoData {
  title: string;
  subtitle?: string;
  body: string;
  image?: string;
  tag?: string;
}

interface MuseumState {
  // Inspect modal (artworks)
  inspecting: Artwork | null;
  inspect: (w: Artwork | null) => void;

  // In-app info panel (eras, artist biographies)
  info: InfoData | null;
  setInfo: (i: InfoData | null) => void;

  // Timeline filters
  axis: AxisFilter;
  setAxis: (a: AxisFilter) => void;
  medium: string;
  setMedium: (m: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

export const useMuseum = create<MuseumState>((set) => ({
  inspecting: null,
  inspect: (w) => set({ inspecting: w }),

  info: null,
  setInfo: (info) => set({ info }),

  axis: "all",
  setAxis: (axis) => set({ axis }),
  medium: "all",
  setMedium: (medium) => set({ medium }),
  query: "",
  setQuery: (query) => set({ query }),
}));
