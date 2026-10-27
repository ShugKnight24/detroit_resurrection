"use client";

import type { ExpressionSpecification, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, type Category, type Property } from "@/lib/properties";
import { loadProperties, loadRevived, saveRevived, houseImage } from "./data";
import styles from "./GraveyardMap.module.css";
import PatientChart from "./PatientChart";

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#0a0d0b" } }],
};
const LAYERS = ["parcels-glow", "parcels", "homes"];

const colorBy = (): ExpressionSpecification => [
  "case",
  ["boolean", ["feature-state", "revived"], false],
  "#ffd166",
  [
    "match",
    ["get", "c"],
    "side",
    CATEGORY_META.side.color,
    "lot",
    CATEGORY_META.lot.color,
    "structure",
    CATEGORY_META.structure.color,
    CATEGORY_META.dormant.color,
  ],
];

async function pickStyle(): Promise<string | StyleSpecification> {
  try {
    const res = await fetch(DARK_STYLE, { signal: AbortSignal.timeout(4000) });
    if (res.ok) return DARK_STYLE;
  } catch {}
  return OFFLINE_STYLE;
}

export default function GraveyardMap() {
  const section = useRef<HTMLElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [active, setActive] = useState<Set<Category>>(new Set(CATEGORIES));
  const [query, setQuery] = useState("");
  const [revived, setRevived] = useState<Set<string>>(new Set());

  // Load 56k parcels only when the map is about to scroll into view.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        loadProperties().then(setProperties, (e: Error) => setError(e.message));
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!properties || !container.current || map.current) return;
    let disposed = false;

    (async () => {
      const [{ Map, NavigationControl, setWorkerUrl }, style] = await Promise.all([
        import("maplibre-gl"),
        pickStyle(),
      ]);
      if (disposed || !container.current) return;
      // Turbopack can't bundle MapLibre's module worker, so it's served from
      // public/ (see the copy-worker script).
      setWorkerUrl("/maplibre-gl-worker.mjs");

      const m = new Map({
        container: container.current,
        style,
        center: [-83.08, 42.37],
        zoom: 11,
        minZoom: 9.5,
        maxZoom: 19,
        cooperativeGestures: true,
      });
      map.current = m;
      m.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

      m.on("load", () => {
        m.addImage("house", houseImage(), { sdf: true });
        m.addSource("parcels", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: properties.map((p) => ({
              type: "Feature",
              id: p.id,
              geometry: { type: "Point", coordinates: [p.lng, p.lat] },
              properties: { c: p.category },
            })),
          },
        });
        m.addLayer({
          id: "parcels-glow",
          type: "circle",
          source: "parcels",
          maxzoom: 16,
          filter: ["!=", ["get", "c"], "dormant"],
          paint: {
            "circle-color": colorBy(),
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 12],
            "circle-blur": 1,
            "circle-opacity": 0.3,
          },
        });
        m.addLayer({
          id: "parcels",
          type: "circle",
          source: "parcels",
          paint: {
            "circle-color": colorBy(),
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              ["case", ["boolean", ["feature-state", "revived"], false], 3, 1.2],
              14,
              3,
              16,
              6,
            ],
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              ["match", ["get", "c"], "dormant", 0.5, 0.9],
              16,
              0,
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2, 0],
          },
        });
        m.addLayer({
          id: "homes",
          type: "symbol",
          source: "parcels",
          minzoom: 15,
          layout: {
            "icon-image": "house",
            "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.35, 18, 0.8],
            "icon-allow-overlap": true,
            "icon-anchor": "bottom",
          },
          paint: {
            "icon-color": colorBy(),
            "icon-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 1],
            "icon-halo-color": "#ffffff",
            "icon-halo-width": ["case", ["boolean", ["feature-state", "selected"], false], 2, 0],
          },
        });

        const stored = loadRevived();
        setRevived(stored);
        for (const p of properties) {
          if (stored.has(p.parcelId)) m.setFeatureState({ source: "parcels", id: p.id }, { revived: true });
        }

        for (const layer of ["parcels", "homes"]) {
          m.on("click", layer, (e) => {
            const id = e.features?.[0]?.id;
            if (typeof id === "number") setSelected(properties[id]);
          });
          m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
        }
      });
    })();

    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, [properties]);

  // Selection highlight follows React state.
  useEffect(() => {
    const m = map.current;
    if (!m || !selected || !m.getSource("parcels")) return;
    m.setFeatureState({ source: "parcels", id: selected.id }, { selected: true });
    return () => {
      if (m.getSource("parcels")) m.setFeatureState({ source: "parcels", id: selected.id }, { selected: false });
    };
  }, [selected]);

  useEffect(() => {
    const m = map.current;
    if (!m?.isStyleLoaded()) return;
    const filter: ExpressionSpecification = ["in", ["get", "c"], ["literal", [...active]]];
    for (const id of LAYERS) {
      if (!m.getLayer(id)) continue;
      m.setFilter(id, id === "parcels-glow" ? ["all", filter, ["!=", ["get", "c"], "dormant"]] : filter);
    }
  }, [active]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!properties || q.length < 3) return [];
    const out: Property[] = [];
    for (const p of properties) {
      if (p.address.toLowerCase().includes(q)) out.push(p);
      if (out.length === 6) break;
    }
    return out;
  }, [properties, query]);

  function focus(p: Property) {
    setSelected(p);
    setQuery("");
    map.current?.flyTo({ center: [p.lng, p.lat], zoom: 17.2, speed: 1.4 });
  }

  function markRevived(p: Property) {
    const next = new Set(revived).add(p.parcelId);
    setRevived(next);
    saveRevived(next);
    map.current?.setFeatureState({ source: "parcels", id: p.id }, { revived: true });
  }

  function toggle(c: Category) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c) && next.size > 1) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  return (
    <section id="map" ref={section} className={styles.section} aria-label="Map of Land Bank properties">
      <div ref={container} className={styles.map} />

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <input
            type="search"
            placeholder="Search an address, like 6795 Seminole"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) focus(matches[0]);
            }}
            aria-label="Search Land Bank properties by address"
            disabled={!properties}
          />
          {matches.length > 0 && (
            <ul className={styles.results}>
              {matches.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => focus(p)}>
                    <span>{p.address}</span>
                    <small>
                      {p.neighborhood} · {CATEGORY_META[p.category].label}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.chips} role="group" aria-label="Filter by type">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={active.has(c)}
              className={styles.chip}
              style={{ "--c": CATEGORY_META[c].color } as React.CSSProperties}
              onClick={() => toggle(c)}
            >
              {CATEGORY_META[c].label}
            </button>
          ))}
          {revived.size > 0 && <span className={styles.revivedCount}>{revived.size} revived by you</span>}
        </div>
      </div>

      {!properties && (
        <div className={styles.loading}>{error ? `Couldn't load parcels: ${error}` : "Opening the ward…"}</div>
      )}

      {selected && properties && (
        <PatientChart
          key={selected.id}
          property={selected}
          all={properties}
          revived={revived.has(selected.parcelId)}
          onClose={() => setSelected(null)}
          onRevived={() => markRevived(selected)}
        />
      )}
    </section>
  );
}
