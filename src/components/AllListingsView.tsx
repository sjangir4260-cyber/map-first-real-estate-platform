import { MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import {
  Dealer,
  Listing,
  Plot,
  STATUS_MAP_STYLE,
  computeEstimatedTotalInr,
  formatInr,
} from '../types/realestate';

interface AllListingsViewProps {
  plots: Plot[];
  dealers: Dealer[];
  listings: Listing[];
  onInspectPlotOnMap: (plotId: string, locality: string) => void;
}

export function AllListingsView({
  plots,
  dealers,
  listings,
  onInspectPlotOnMap,
}: AllListingsViewProps) {
  const approvedListings = listings.filter((l) => l.approval_status === 'Approved');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="mx-auto max-w-6xl px-6 py-8"
    >
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Buy–Sell Registry
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          All Approved Plot Listings ({approvedListings.length})
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Compare dealer quotes across plots, price units, and availability status.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              <th className="px-4 py-3">Plot</th>
              <th className="px-4 py-3">Locality</th>
              <th className="px-4 py-3 text-right">Area</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Quoted Price</th>
              <th className="px-4 py-3 text-right">Est. Total</th>
              <th className="px-4 py-3">Dealer / Owner</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {approvedListings.map((listing) => {
              const plot = plots.find((p) => p.plot_id === listing.plot_id);
              const dealer = dealers.find((d) => d.dealer_id === listing.dealer_id);
              if (!plot) return null;
              const style = STATUS_MAP_STYLE[listing.availability_status];
              const estTotal = computeEstimatedTotalInr(listing, plot.area_sqyd);

              return (
                <tr key={listing.listing_id} className="hover:bg-slate-50/75">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-900">{plot.plot_id}</div>
                    <div className="text-[11px] text-slate-500">{plot.plot_number}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{plot.locality}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                    {plot.area_sqyd} sq.yd
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${style.textClass}`}>
                      <span className={`h-2 w-2 rounded-full ${style.dotClass}`} />
                      {listing.availability_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {formatInr(listing.asking_price)}
                    <div className="font-sans text-[10px] font-normal text-slate-500">
                      {listing.price_unit}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {formatInr(estTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{dealer?.name ?? '—'}</div>
                    <div className="text-[11px] text-slate-500">{dealer?.agency}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 tabular-nums">
                    {listing.updated_at}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onInspectPlotOnMap(plot.plot_id, plot.locality)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100 whitespace-nowrap"
                    >
                      <MapPin className="h-3 w-3" />
                      Locate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
