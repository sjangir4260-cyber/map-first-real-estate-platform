import { Building2, Lock, Mail, MapPin, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import {
  Dealer,
  Listing,
  Plot,
  STATUS_MAP_STYLE,
  computeEstimatedTotalInr,
  formatInr,
} from '../types/realestate';

interface DealerDirectoryProps {
  dealers: Dealer[];
  plots: Plot[];
  listings: Listing[];
  onInspectPlotOnMap: (plotId: string, locality: string) => void;
}

export function DealerDirectory({
  dealers,
  plots,
  listings,
  onInspectPlotOnMap,
}: DealerDirectoryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="mx-auto max-w-6xl px-6 py-8"
    >
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Verified Brokers &amp; Direct Owners
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          Dealer Directory ({dealers.length})
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Contact details are displayed strictly when the dealer or owner has granted publication consent.
        </p>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {dealers.map((dealer) => {
          const dealerListings = listings.filter(
            (l) => l.dealer_id === dealer.dealer_id && l.approval_status === 'Approved'
          );

          return (
            <div
              key={dealer.dealer_id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">
                        {dealer.dealer_id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{dealer.locality_focus}</span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-slate-950">{dealer.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>{dealer.agency}</span>
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      dealer.account_status === 'Active' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {dealer.account_status}
                  </span>
                </div>

                {/* Consent-respecting contact info */}
                {dealer.consent_to_publish ? (
                  <div className="mt-4 flex flex-wrap gap-4 border-y border-slate-100 py-2.5 text-xs text-slate-700">
                    <a
                      href={`tel:${dealer.phone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 font-medium hover:text-red-700"
                    >
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {dealer.phone}
                    </a>
                    {dealer.email && (
                      <a
                        href={`mailto:${dealer.email}`}
                        className="inline-flex items-center gap-1.5 font-medium hover:text-red-700"
                      >
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {dealer.email}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-1.5 border-y border-slate-100 py-2.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    Private contact withheld — submit enquiry directly from any listed plot
                  </div>
                )}

                {/* Dealer's Listed Plots */}
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase">
                    Active Plots Listed ({dealerListings.length})
                  </h3>
                  {dealerListings.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">No active approved listings.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100">
                      {dealerListings.map((listing) => {
                        const plot = plots.find((p) => p.plot_id === listing.plot_id);
                        if (!plot) return null;
                        const style = STATUS_MAP_STYLE[listing.availability_status];
                        const total = computeEstimatedTotalInr(listing, plot.area_sqyd);

                        return (
                          <div
                            key={listing.listing_id}
                            className="flex items-center justify-between gap-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-slate-800">
                                  {plot.plot_id}
                                </span>
                                <span className={`font-medium ${style.textClass}`}>
                                  {listing.availability_status}
                                </span>
                              </div>
                              <p className="truncate text-slate-500">
                                {plot.plot_number} · {plot.locality}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                {formatInr(total)}
                              </span>
                              <button
                                type="button"
                                onClick={() => onInspectPlotOnMap(plot.plot_id, plot.locality)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                              >
                                <MapPin className="h-3 w-3" />
                                Map
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
