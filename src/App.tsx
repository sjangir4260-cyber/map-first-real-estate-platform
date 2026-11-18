import { Box, Map as MapIcon, Pencil, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminConsole } from './components/AdminConsole';
import { AllListingsView } from './components/AllListingsView';
import { DealerDirectory } from './components/DealerDirectory';
import { NewPlotModal } from './components/NewPlotModal';
import { Plot3DScene } from './components/Plot3DScene';
import { PlotDetailPanel } from './components/PlotDetailPanel';
import { PlotMap } from './components/PlotMap';
import { SEED_DATA } from './data/seedData';
import {
  AvailabilityStatus,
  DatabaseState,
  Dealer,
  LOCALITIES,
  Listing,
  Plot,
  PriceUnit,
  computeEstimatedTotalInr,
  derivePlotStatus,
} from './types/realestate';

type ActiveView = 'map' | 'listings' | 'dealers' | 'admin';

export default function App() {
  const [db, setDb] = useState<DatabaseState>(SEED_DATA);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ActiveView>('map');
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('2d');

  // Map & Filter state
  const [activeLocality, setActiveLocality] = useState<string>('Vaishali Nagar');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | AvailabilityStatus>('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<'all' | '100L' | '180L' | '250L'>('all');
  const [areaFilter, setAreaFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [dealerFilter, setDealerFilter] = useState<string>('All');

  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);

  // Admin polygon drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [newPlotModalOpen, setNewPlotModalOpen] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = (await res.json()) as DatabaseState;
        setDb(data);
      }
    } catch {
      // Fallback keeps seed data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Filtered plots
  const filteredPlots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.plots.filter((plot) => {
      if (activeLocality !== 'All' && plot.locality !== activeLocality) {
        return false;
      }

      const plotListings = db.listings.filter(
        (l) => l.plot_id === plot.plot_id && l.approval_status === 'Approved'
      );
      const status = derivePlotStatus(plot.plot_id, db.listings);

      if (statusFilter !== 'All' && status !== statusFilter) {
        return false;
      }

      if (areaFilter === 'small' && plot.area_sqyd > 200) return false;
      if (areaFilter === 'medium' && (plot.area_sqyd <= 200 || plot.area_sqyd > 280)) return false;
      if (areaFilter === 'large' && plot.area_sqyd <= 280) return false;

      if (dealerFilter !== 'All') {
        const hasDealer = plotListings.some((l) => l.dealer_id === dealerFilter);
        if (!hasDealer) return false;
      }

      if (maxPriceFilter !== 'all') {
        if (plotListings.length === 0) return false;
        const cap =
          maxPriceFilter === '100L'
            ? 10000000
            : maxPriceFilter === '180L'
              ? 18000000
              : 25000000;
        const minEst = Math.min(
          ...plotListings.map((l) => computeEstimatedTotalInr(l, plot.area_sqyd))
        );
        if (minEst > cap) return false;
      }

      if (q) {
        const dealerMatch = plotListings.some((l) => {
          const d = db.dealers.find((dl) => dl.dealer_id === l.dealer_id);
          return d && (d.name.toLowerCase().includes(q) || d.agency.toLowerCase().includes(q));
        });
        const plotMatch =
          plot.plot_id.toLowerCase().includes(q) ||
          plot.plot_number.toLowerCase().includes(q) ||
          plot.locality.toLowerCase().includes(q) ||
          plot.address_landmark.toLowerCase().includes(q);
        if (!plotMatch && !dealerMatch) return false;
      }

      return true;
    });
  }, [
    db.plots,
    db.listings,
    db.dealers,
    activeLocality,
    searchQuery,
    statusFilter,
    maxPriceFilter,
    areaFilter,
    dealerFilter,
  ]);

  const selectedPlot = useMemo(
    () => db.plots.find((p) => p.plot_id === selectedPlotId) ?? null,
    [db.plots, selectedPlotId]
  );

  // API mutations
  const handleSaveNewPlot = async (payload: {
    plot: Omit<Plot, 'plot_id'>;
    initialListing?: {
      dealer_id: string;
      asking_price: number;
      price_unit: PriceUnit;
      description: string;
    };
  }) => {
    const plotRes = await fetch('/api/plots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.plot),
    });
    if (!plotRes.ok) return;
    const createdPlot = (await plotRes.json()) as Plot;

    if (payload.initialListing) {
      await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plot_id: createdPlot.plot_id,
          dealer_id: payload.initialListing.dealer_id,
          asking_price: payload.initialListing.asking_price,
          price_unit: payload.initialListing.price_unit,
          availability_status: 'For Sale',
          approval_status: 'Approved',
          description: payload.initialListing.description,
        }),
      });
    }

    await fetchState();
    setDraftPoints([]);
    setIsDrawingMode(false);
    setActiveLocality(createdPlot.locality);
    setSelectedPlotId(createdPlot.plot_id);
  };

  const handleUpdatePlot = async (plotId: string, patch: Partial<Plot>) => {
    await fetch(`/api/plots/${encodeURIComponent(plotId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await fetchState();
  };

  const handleCreateListing = async (payload: Omit<Listing, 'listing_id' | 'updated_at'>) => {
    await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchState();
  };

  const handleUpdateListing = async (listingId: string, patch: Partial<Listing>) => {
    await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await fetchState();
  };

  const handleDeleteListing = async (listingId: string) => {
    await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
      method: 'DELETE',
    });
    await fetchState();
  };

  const handleCreateDealer = async (payload: Omit<Dealer, 'dealer_id'>) => {
    await fetch('/api/dealers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchState();
  };

  const handleUpdateDealer = async (dealerId: string, patch: Partial<Dealer>) => {
    await fetch(`/api/dealers/${encodeURIComponent(dealerId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await fetchState();
  };

  const handleSubmitEnquiry = async (payload: {
    listing_id: string;
    plot_id: string;
    dealer_id: string;
    sender_name: string;
    sender_contact: string;
    message: string;
  }) => {
    const res = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to send enquiry');
    await fetchState();
  };

  const handleResetDemo = async () => {
    await fetch('/api/reset-demo', { method: 'POST' });
    setSelectedPlotId(null);
    await fetchState();
  };

  const handleInspectPlotOnMap = (plotId: string, locality: string) => {
    setActiveLocality(locality);
    setStatusFilter('All');
    setSearchQuery('');
    setSelectedPlotId(plotId);
    setView('map');
  };

  const handleStartDrawing = () => {
    setView('map');
    setMapMode('2d');
    setSelectedPlotId(null);
    setDraftPoints([]);
    setIsDrawingMode(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-[1050] border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-5 py-3">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setView('map')}
            className="text-left text-base font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            PlotLedger
          </button>

          {/* Zone 2: 4 Single-line Nav Links */}
          <nav aria-label="Primary modules" className="flex items-center gap-5 overflow-x-auto">
            {(
              [
                { id: 'map', label: 'Map Explorer' },
                { id: 'listings', label: 'Buy–Sell Listings' },
                { id: 'dealers', label: 'Dealer Directory' },
                { id: 'admin', label: 'Admin Console' },
              ] as const
            ).map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`border-b-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-red-600 text-slate-950'
                      : 'border-transparent text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <button
            type="button"
            onClick={handleStartDrawing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Draw Plot</span>
          </button>
        </div>
      </header>

      {/* VIEW 1: MAP & LOCALITY EXPLORER */}
      {view === 'map' && (
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5"
        >
          {/* Compact Search & Filter Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
            {/* Locality Selector */}
            <select
              aria-label="Select locality"
              value={activeLocality}
              onChange={(e) => {
                setActiveLocality(e.target.value);
                setSelectedPlotId(null);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="All">All Demo Localities</option>
              {LOCALITIES.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Plot ID, landmark, or dealer..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Segmented Filter */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(['All', 'For Sale', 'Reserved', 'Sold', 'Unverified'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Max Price Filter */}
            <select
              aria-label="Filter by maximum price"
              value={maxPriceFilter}
              onChange={(e) =>
                setMaxPriceFilter(e.target.value as 'all' | '100L' | '180L' | '250L')
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
            >
              <option value="all">Any Price</option>
              <option value="100L">Up to ₹1.0 Cr</option>
              <option value="180L">Up to ₹1.8 Cr</option>
              <option value="250L">Up to ₹2.5 Cr</option>
            </select>

            {/* Plot Area Filter */}
            <select
              aria-label="Filter by plot area"
              value={areaFilter}
              onChange={(e) =>
                setAreaFilter(e.target.value as 'all' | 'small' | 'medium' | 'large')
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
            >
              <option value="all">Any Area</option>
              <option value="small">Up to 200 sq.yd</option>
              <option value="medium">201 – 280 sq.yd</option>
              <option value="large">280+ sq.yd</option>
            </select>

            {/* Dealer Filter */}
            <select
              aria-label="Filter by dealer"
              value={dealerFilter}
              onChange={(e) => setDealerFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
            >
              <option value="All">All Dealers</option>
              {db.dealers.map((d) => (
                <option key={d.dealer_id} value={d.dealer_id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* 2D Map / 3D Parcels Mode Toggle */}
            <div
              role="group"
              aria-label="Map viewport mode"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
            >
              <button
                type="button"
                onClick={() => setMapMode('2d')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  mapMode === '2d'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <MapIcon className="h-3 w-3" />
                <span>2D Map</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setMapMode('3d');
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  mapMode === '3d'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Box className="h-3 w-3" />
                <span>3D Parcels</span>
              </button>
            </div>
          </div>

          {/* Map + Detail Panel Split */}
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="h-[540px] animate-pulse rounded-xl border border-slate-200 bg-slate-200/70 lg:col-span-8" />
              <div className="h-[540px] animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-4" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="h-[520px] lg:col-span-8 lg:h-[calc(100vh-152px)]">
                {mapMode === '2d' ? (
                  <PlotMap
                    plots={filteredPlots}
                    listings={db.listings}
                    selectedPlotId={selectedPlotId}
                    hoveredPlotId={hoveredPlotId}
                    activeLocality={activeLocality}
                    isDrawingMode={isDrawingMode}
                    draftPoints={draftPoints}
                    onSelectPlot={(id) => setSelectedPlotId(id)}
                    onAddDraftPoint={(pt) => setDraftPoints((prev) => [...prev, pt])}
                    onUndoDraftPoint={() => setDraftPoints((prev) => prev.slice(0, -1))}
                    onCancelDrawing={() => {
                      setIsDrawingMode(false);
                      setDraftPoints([]);
                    }}
                    onFinishDrawing={() => setNewPlotModalOpen(true)}
                  />
                ) : (
                  <Plot3DScene
                    plots={filteredPlots}
                    listings={db.listings}
                    selectedPlotId={selectedPlotId}
                    hoveredPlotId={hoveredPlotId}
                    activeLocality={activeLocality}
                    onSelectPlot={(id) => setSelectedPlotId(id)}
                    onHoverPlot={(id) => setHoveredPlotId(id)}
                  />
                )}
              </div>

              <div className="h-[520px] lg:col-span-4 lg:h-[calc(100vh-152px)]">
                <PlotDetailPanel
                  plots={filteredPlots}
                  selectedPlot={selectedPlot}
                  dealers={db.dealers}
                  listings={db.listings}
                  onSelectPlot={(id) => setSelectedPlotId(id)}
                  onHoverPlot={(id) => setHoveredPlotId(id)}
                  onSubmitEnquiry={handleSubmitEnquiry}
                />
              </div>
            </div>
          )}
        </motion.main>
      )}

      {/* VIEW 2: ALL LISTINGS REGISTRY */}
      {view === 'listings' && (
        <AllListingsView
          plots={db.plots}
          dealers={db.dealers}
          listings={db.listings}
          onInspectPlotOnMap={handleInspectPlotOnMap}
        />
      )}

      {/* VIEW 3: DEALER DIRECTORY */}
      {view === 'dealers' && (
        <DealerDirectory
          dealers={db.dealers}
          plots={db.plots}
          listings={db.listings}
          onInspectPlotOnMap={handleInspectPlotOnMap}
        />
      )}

      {/* VIEW 4: ADMIN & DEALER CONSOLE */}
      {view === 'admin' && (
        <AdminConsole
          plots={db.plots}
          dealers={db.dealers}
          listings={db.listings}
          enquiries={db.enquiries}
          onStartDrawOnMap={handleStartDrawing}
          onUpdatePlot={handleUpdatePlot}
          onCreateListing={handleCreateListing}
          onUpdateListing={handleUpdateListing}
          onDeleteListing={handleDeleteListing}
          onCreateDealer={handleCreateDealer}
          onUpdateDealer={handleUpdateDealer}
          onResetDemo={handleResetDemo}
        />
      )}

      <NewPlotModal
        isOpen={newPlotModalOpen}
        coordinates={draftPoints}
        defaultLocality={activeLocality}
        dealers={db.dealers}
        onClose={() => setNewPlotModalOpen(false)}
        onSave={handleSaveNewPlot}
      />
    </div>
  );
}
