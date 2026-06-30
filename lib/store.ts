"use client";
import { create } from "zustand";
import type { Artwork } from "./data/types";

export type AxisFilter = "all" | "world" | "india";

interface MuseumState {
  // Inspect modal
  inspecting: Artwork | null;
  inspect: (w: Artwork | null) => void;

  // Timeline filters
  axis: AxisFilter;
  setAxis: (a: AxisFilter) => void;
  medium: string; // "all" or a Medium
  setMedium: (m: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

export const useMuseum = create<MuseumState>((set) => ({
  inspecting: null,
  inspect: (w) => set({ inspecting: w }),

  axis: "all",
  setAxis: (axis) => set({ axis }),
  medium: "all",
  setMedium: (medium) => set({ medium }),
  query: "",
  setQuery: (query) => set({ query }),
}));
