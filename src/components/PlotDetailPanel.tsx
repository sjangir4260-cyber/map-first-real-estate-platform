import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Compass,
  Lock,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import {
  Dealer,
  Listing,
  Plot,
  STATUS_MAP_STYLE,
  computeEstimatedTotalInr,
  derivePlotStatus,
  formatInr,
} from '../types/realestate';

interface PlotDetailPanelProps {
  plots: Plot[];
  selectedPlot: Plot | null;
  dealers: Dealer[];
  listings: Listing[];
  onSelectPlot: (plotId: string | null) => void;
  onHoverPlot: (plotId: string | null) => void;
  onSubmitEnquiry: (payload: {
    listing_id: string;
    plot_id: string;
    dealer_id: string;
    sender_name: string;
    sender_contact: string;
    message: string;
  }) => Promise<void>;
}

function ParcelBlueprint({ coordinates }: { coordinates: [number, number][] }) {
  if (coordinates.length < 3) return null;
  const lats = coordinates.map((c) => c[0]);
  const lngs = coordinates.map((c) => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.0005;
  const lngSpan = maxLng - minLng || 0.0005;

  const points = coordinates
    .map(([lat, lng]) => {
      const x = 14 + ((lng - minLng) / lngSpan) * 72;
      const y = 14 + (1 - (lat - minLat) / latSpan) * 52;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, rotateX: 28, rotateY: -18, scale: 0.92 }}
      animate={{ opacity: 1, rotateX: 8, rotateY: -6, scale: 1 }}
      whileHover={{ rotateX: 0, rotateY: 0, scale: 1.06, y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{ transformPerspective: 600 }}
      className="shrink-0"
    >
      <svg
        viewBox="0 0 100 80"
        className="h-20 w-24 rounded-lg border border-slate-200 bg-slate-50 shadow-xs"
        aria-hidden="true"
      >
        <defs>
          <pattern id="parcel-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100" height="80" fill="url(#parcel-grid)" />
        <polygon
          points={points}
          fill="rgba(220, 38, 38, 0.16)"
          stroke="#DC2626"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

export function PlotDetailPanel({
  plots,
  selectedPlot,
  dealers,
  listings,
  onSelectPlot,
  onHoverPlot,
  onSubmitEnquiry,
}: PlotDetailPanelProps) {
  const [activeEnquiryListingId, setActiveEnquiryListingId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentForListing, setSentForListing] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  if (!selectedPlot) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Mapped Parcels ({plots.length})
            </h2>
            <span className="text-xs text-slate-500">Click map or parcel below</span>
          </div>
        </div>

        {plots.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <p className="text-sm font-medium text-slate-800">No plots match your current filters</p>
            <p className="mt-1 text-xs text-slate-500">
              Widen your price range, status, or locality search above.
            </p>
          </div>
        ) : (
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {plots.map((plot) => {
              const status = derivePlotStatus(plot.plot_id, listings);
              const style = STATUS_MAP_STYLE[status];
              const plotListings = listings.filter(
                (l) => l.plot_id === plot.plot_id && l.approval_status === 'Approved'
              );
              const lowestEstimated =
                plotListings.length > 0
                  ? Math.min(
                      ...plotListings.map((l) => computeEstimatedTotalInr(l, plot.area_sqyd))
                    )
                  : null;

              return (
                <button
                  key={plot.plot_id}
                  type="button"
                  onClick={() => onSelectPlot(plot.plot_id)}
                  onMouseEnter={() => onHoverPlot(plot.plot_id)}
                  onMouseLeave={() => onHoverPlot(null)}
                  className="flex w-full items-start justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-800">
                        {plot.plot_id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{plot.locality}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate">
                      {plot.plot_number}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {plot.area_sqyd} sq. yd. ({plot.dimensions}) · {plotListings.length}{' '}
                      {plotListings.length === 1 ? 'listing' : 'listings'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.textClass}`}>
                      <span className={`h-2 w-2 rounded-full ${style.dotClass}`} />
                      {status}
                    </span>
                    {lowestEstimated !== null && (
                      <p className="mt-1 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {formatInr(lowestEstimated)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const plotListings = listings.filter(
    (l) => l.plot_id === selectedPlot.plot_id && l.approval_status === 'Approved'
  );
  const status = derivePlotStatus(selectedPlot.plot_id, listings);
  const style = STATUS_MAP_STYLE[status];

  const handleEnquirySubmit = async (e: React.FormEvent, listing: Listing) => {
    e.preventDefault();
    setFormError('');
    if (!senderName.trim() || !senderContact.trim()) {
      setFormError('Please provide your name and phone or email.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitEnquiry({
        listing_id: listing.listing_id,
        plot_id: selectedPlot.plot_id,
        dealer_id: listing.dealer_id,
        sender_name: senderName,
        sender_contact: senderContact,
        message: message || `Enquiry regarding ${selectedPlot.plot_number} (${selectedPlot.plot_id})`,
      });
      setSentForListing(listing.listing_id);
      setActiveEnquiryListingId(null);
      setSenderName('');
      setSenderContact('');
      setMessage('');
    } catch {
      setFormError('Failed to send enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selectedPlot.plot_id}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={() => onSelectPlot(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Mapped Plots
          </button>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.textClass}`}>
            <span className={`h-2 w-2 rounded-full ${style.dotClass}`} />
            {status}
          </span>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Plot Header + Blueprint */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  {selectedPlot.plot_id}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedPlot.locality}</span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-950">
                {selectedPlot.plot_number}
              </h2>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{selectedPlot.address_landmark}</span>
              </p>
            </div>
            <ParcelBlueprint coordinates={selectedPlot.coordinates} />
          </div>

          {/* Boundary Verification Disclaimer */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Boundary Source:</span>{' '}
            {selectedPlot.boundary_source} ({selectedPlot.verification_status})
          </div>

          {/* Core Dimensions Grid */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white text-center">
            <div className="px-2 py-2.5">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                <Ruler className="h-3 w-3" />
                Area
              </div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {selectedPlot.area_sqyd} sq.yd
              </div>
            </div>
            <div className="px-2 py-2.5">
              <div className="text-[11px] text-slate-500">Dimensions</div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {selectedPlot.dimensions}
              </div>
            </div>
            <div className="px-2 py-2.5">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                <Compass className="h-3 w-3" />
                Facing
              </div>
              <div className="mt-0.5 text-xs font-semibold text-slate-900">
                {selectedPlot.facing}
              </div>
            </div>
          </div>

          {selectedPlot.notes && (
            <p className="text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Parcel notes: </span>
              {selectedPlot.notes}
            </p>
          )}

          {/* Multiple Dealer Listings Comparison */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Dealer &amp; Owner Listings ({plotListings.length})
              </h3>
              {plotListings.length > 1 && (
                <span className="text-[11px] font-medium text-emerald-700">
                  Compare {plotListings.length} quotes
                </span>
              )}
            </div>

            {plotListings.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                No active approved sale listings for this plot yet.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {plotListings.map((listing) => {
                  const dealer = dealers.find((d) => d.dealer_id === listing.dealer_id);
                  const totalEst = computeEstimatedTotalInr(listing, selectedPlot.area_sqyd);
                  const isEnquiryOpen = activeEnquiryListingId === listing.listing_id;
                  const isSent = sentForListing === listing.listing_id;

                  return (
                    <div
                      key={listing.listing_id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-base font-bold text-slate-950 tabular-nums">
                            {formatInr(listing.asking_price)}
                            <span className="ml-1.5 text-xs font-medium text-slate-500">
                              ({listing.price_unit})
                            </span>
                          </div>
                          {listing.price_unit !== 'Total Price' && (
                            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                              Est. total: {formatInr(totalEst)} for {selectedPlot.area_sqyd} sq.yd
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          Updated {listing.updated_at}
                        </span>
                      </div>

                      {listing.description && (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {listing.description}
                        </p>
                      )}

                      {/* Dealer / Owner Block */}
                      {dealer && (
                        <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-900">{dealer.name}</p>
                              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Building2 className="h-3 w-3" />
                                {dealer.agency}
                              </p>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500">
                              {listing.availability_status}
                            </span>
                          </div>

                          {dealer.consent_to_publish ? (
                            <div className="mt-2.5 flex flex-wrap gap-3 border-t border-slate-200/70 pt-2 text-[11px] text-slate-700">
                              <a
                                href={`tel:${dealer.phone.replace(/\s+/g, '')}`}
                                className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-red-700"
                              >
                                <Phone className="h-3 w-3 text-slate-400" />
                                {dealer.phone}
                              </a>
                              {dealer.email && (
                                <a
                                  href={`mailto:${dealer.email}`}
                                  className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-red-700"
                                >
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  {dealer.email}
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-200/70 pt-2 text-[11px] text-slate-500">
                              <Lock className="h-3 w-3 text-slate-400" />
                              Direct contact hidden by owner preference — enquire below
                            </div>
                          )}
                        </div>
                      )}

                      {/* Enquiry toggle / sent confirmation */}
                      <div className="mt-3">
                        {isSent ? (
                          <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            Enquiry sent and logged for {dealer?.name ?? 'listing provider'}.
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveEnquiryListingId(
                                isEnquiryOpen ? null : listing.listing_id
                              )
                            }
                            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                          >
                            {isEnquiryOpen ? 'Close Enquiry Form' : 'Enquire / Request Callback'}
                          </button>
                        )}
                      </div>

                      {isEnquiryOpen && (
                        <form
                          onSubmit={(e) => handleEnquirySubmit(e, listing)}
                          className="mt-3 space-y-2.5 border-t border-slate-100 pt-3"
                        >
                          <input
                            type="text"
                            required
                            placeholder="Your full name"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Phone number or email (voluntary)"
                            value={senderContact}
                            onChange={(e) => setSenderContact(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                          />
                          <textarea
                            rows={2}
                            placeholder="Preferred site visit timing or questions..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                          />
                          {formError && <p className="text-xs text-red-600">{formError}</p>}
                          <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>{submitting ? 'Sending...' : 'Submit Enquiry'}</span>
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
