import L from 'leaflet';
import { Check, Layers, LocateFixed, Pencil, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  AvailabilityStatus,
  LOCALITIES,
  Listing,
  Plot,
  STATUS_MAP_STYLE,
  derivePlotStatus,
} from '../types/realestate';

interface PlotMapProps {
  plots: Plot[];
  listings: Listing[];
  selectedPlotId: string | null;
  hoveredPlotId: string | null;
  activeLocality: string;
  includePendingInStatus?: boolean;
  isDrawingMode: boolean;
  draftPoints: [number, number][];
  onSelectPlot: (plotId: string) => void;
  onAddDraftPoint: (point: [number, number]) => void;
  onUndoDraftPoint: () => void;
  onCancelDrawing: () => void;
  onFinishDrawing: () => void;
}

type BaseMapStyle = 'Street' | 'Satellite' | 'Topographic';

const BASE_MAP_LAYERS: Record<
  BaseMapStyle,
  { url: string; attribution: string; maxZoom: number }
> = {
  Street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, OpenStreetMap contributors',
    maxZoom: 19,
  },
  Satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  Topographic: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, OpenStreetMap contributors',
    maxZoom: 19,
  },
};

export function PlotMap({
  plots,
  listings,
  selectedPlotId,
  hoveredPlotId,
  activeLocality,
  includePendingInStatus = false,
  isDrawingMode,
  draftPoints,
  onSelectPlot,
  onAddDraftPoint,
  onUndoDraftPoint,
  onCancelDrawing,
  onFinishDrawing,
}: PlotMapProps) {
  const [baseStyle, setBaseStyle] = useState<BaseMapStyle>('Street');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const plotLayerRef = useRef<L.LayerGroup | null>(null);
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  const isDrawingRef = useRef(isDrawingMode);
  const onAddDraftPointRef = useRef(onAddDraftPoint);
  const onSelectPlotRef = useRef(onSelectPlot);

  isDrawingRef.current = isDrawingMode;
  onAddDraftPointRef.current = onAddDraftPoint;
  onSelectPlotRef.current = onSelectPlot;

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLoc = LOCALITIES[0];
    const map = L.map(containerRef.current, {
      center: initialLoc.center,
      zoom: initialLoc.zoom,
      zoomControl: true,
    });

    const initialTile = BASE_MAP_LAYERS.Street;
    const baseLayer = L.tileLayer(initialTile.url, {
      attribution: initialTile.attribution,
      maxZoom: initialTile.maxZoom,
    }).addTo(map);
    baseLayerRef.current = baseLayer;

    const plotLayer = L.layerGroup().addTo(map);
    const drawLayer = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isDrawingRef.current) {
        onAddDraftPointRef.current([
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ]);
      }
    });

    mapRef.current = map;
    plotLayerRef.current = plotLayer;
    drawLayerRef.current = drawLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      plotLayerRef.current = null;
      drawLayerRef.current = null;
    };
  }, []);

  // Switch Leaflet base map tile layer when style changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }

    const cfg = BASE_MAP_LAYERS[baseStyle];
    const nextLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    });
    nextLayer.addTo(map);
    nextLayer.bringToBack();
    baseLayerRef.current = nextLayer;
  }, [baseStyle]);

  // Fly to selected locality when locality filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeLocality === 'All') {
      if (plots.length > 0) {
        const allCoords = plots.flatMap((p) => p.coordinates);
        if (allCoords.length > 0) {
          const bounds = L.latLngBounds(allCoords);
          map.flyToBounds(bounds, { padding: [48, 48], duration: 0.7, maxZoom: 16 });
        }
      }
      return;
    }

    const loc = LOCALITIES.find((l) => l.name === activeLocality);
    if (loc) {
      map.flyTo(loc.center, loc.zoom, { duration: 0.7 });
    }
  }, [activeLocality]);

  // Center gently when a plot is selected from list/directory
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlotId) return;
    const plot = plots.find((p) => p.plot_id === selectedPlotId);
    if (!plot || plot.coordinates.length === 0) return;

    const bounds = L.latLngBounds(plot.coordinates);
    if (!map.getBounds().contains(bounds)) {
      map.flyToBounds(bounds, { padding: [80, 80], maxZoom: 18, duration: 0.55 });
    }
  }, [selectedPlotId, plots]);

  // Render plot polygons whenever plots, listings, selection, or hover changes
  useEffect(() => {
    const layer = plotLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    plots.forEach((plot) => {
      if (plot.coordinates.length < 3) return;
      const status: AvailabilityStatus = derivePlotStatus(
        plot.plot_id,
        listings,
        includePendingInStatus
      );
      const baseStyle = STATUS_MAP_STYLE[status];
      const isSelected = plot.plot_id === selectedPlotId;
      const isHovered = plot.plot_id === hoveredPlotId;

      const polygon = L.polygon(plot.coordinates, {
        color: isSelected ? '#0F172A' : baseStyle.color,
        weight: isSelected ? 3 : isHovered ? 2.5 : 1.75,
        fillColor: baseStyle.fillColor,
        fillOpacity: isSelected ? Math.min(baseStyle.fillOpacity + 0.2, 0.7) : isHovered ? baseStyle.fillOpacity + 0.12 : baseStyle.fillOpacity,
        dashArray: isSelected ? undefined : baseStyle.dashArray,
      });

      polygon.bindTooltip(`${plot.plot_id} · ${plot.area_sqyd} sq.yd · ${status}`, {
        sticky: true,
        direction: 'top',
        className: 'plot-label-tooltip',
      });

      polygon.on('click', (e: L.LeafletMouseEvent) => {
        if (isDrawingRef.current) return;
        L.DomEvent.stopPropagation(e);
        onSelectPlotRef.current(plot.plot_id);
      });

      polygon.addTo(layer);
    });
  }, [plots, listings, selectedPlotId, hoveredPlotId, includePendingInStatus]);

  // Render draft polygon while in drawing mode
  useEffect(() => {
    const layer = drawLayerRef.current;
    const container = containerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (container) {
      container.style.cursor = isDrawingMode ? 'crosshair' : '';
    }

    if (!isDrawingMode || draftPoints.length === 0) return;

    draftPoints.forEach((pt, index) => {
      L.circleMarker(pt, {
        radius: index === 0 ? 6 : 4.5,
        color: '#0F172A',
        weight: 2,
        fillColor: index === 0 ? '#DC2626' : '#FFFFFF',
        fillOpacity: 1,
      }).addTo(layer);
    });

    if (draftPoints.length >= 2) {
      L.polyline(draftPoints, {
        color: '#0F172A',
        weight: 2,
        dashArray: '6, 4',
      }).addTo(layer);
    }

    if (draftPoints.length >= 3) {
      L.polygon(draftPoints, {
        color: '#DC2626',
        weight: 2,
        fillColor: '#DC2626',
        fillOpacity: 0.25,
      }).addTo(layer);
    }
  }, [isDrawingMode, draftPoints]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (activeLocality !== 'All') {
      const loc = LOCALITIES.find((l) => l.name === activeLocality);
      if (loc) {
        map.flyTo(loc.center, loc.zoom, { duration: 0.5 });
        return;
      }
    }
    const allCoords = plots.flatMap((p) => p.coordinates);
    if (allCoords.length > 0) {
      map.flyToBounds(L.latLngBounds(allCoords), { padding: [48, 48], duration: 0.5, maxZoom: 16 });
    }
  };

  return (
    <div className="relative h-full min-h-[460px] w-full overflow-hidden rounded-xl border border-stone-200 bg-slate-100">
      <div ref={containerRef} className="h-full w-full" />

      {/* Drawing mode floating bar */}
      {isDrawingMode && (
        <div className="absolute top-3 left-1/2 z-[1000] flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/95 px-3.5 py-2 text-xs text-white shadow-lg backdrop-blur-sm">
          <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
            <Pencil className="h-3.5 w-3.5 text-red-400" />
            Click map to place corners ({draftPoints.length} pts)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onUndoDraftPoint}
              disabled={draftPoints.length === 0}
              className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3" />
              Undo
            </button>
            <button
              type="button"
              onClick={onFinishDrawing}
              disabled={draftPoints.length < 3}
              className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40 whitespace-nowrap"
            >
              <Check className="h-3 w-3" />
              Save Boundary
            </button>
            <button
              type="button"
              onClick={onCancelDrawing}
              className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 whitespace-nowrap"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Top-right Map Controls: Layer Toggle + Recenter */}
      <div className="absolute top-3 right-3 z-[900] flex flex-wrap items-center justify-end gap-2">
        <div
          role="group"
          aria-label="Base map layer style"
          className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-xs backdrop-blur-xs"
        >
          <span className="hidden items-center px-1.5 text-slate-400 sm:inline-flex" aria-hidden="true">
            <Layers className="h-3.5 w-3.5" />
          </span>
          {(['Street', 'Satellite', 'Topographic'] as const).map((style) => {
            const active = baseStyle === style;
            return (
              <button
                key={style}
                type="button"
                aria-pressed={active}
                onClick={() => setBaseStyle(style)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                {style}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter map to locality plots"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs backdrop-blur-xs transition-colors hover:bg-white hover:text-slate-950 whitespace-nowrap shrink-0"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Recenter</span>
        </button>
      </div>

      {/* Map Legend & Demo Disclaimer */}
      <div className="absolute bottom-3 left-3 z-[900] max-w-[320px] rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] border border-red-700 bg-red-600/70" />
            For Sale
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] border border-amber-700 bg-amber-500/60" />
            Reserved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] border border-slate-600 bg-slate-500/50" />
            Sold
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] border border-dashed border-stone-500 bg-stone-300/60" />
            Unverified
          </span>
        </div>
        <p className="mt-1.5 border-t border-slate-100 pt-1 text-[10.5px] leading-tight text-slate-500">
          Sample demo boundaries — illustrative only, not legally verified.
        </p>
      </div>
    </div>
  );
}
