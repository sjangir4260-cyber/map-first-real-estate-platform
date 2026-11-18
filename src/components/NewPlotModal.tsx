import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { BoundarySource, Dealer, LOCALITIES, Plot, PriceUnit } from '../types/realestate';

interface NewPlotModalProps {
  isOpen: boolean;
  coordinates: [number, number][];
  defaultLocality: string;
  dealers: Dealer[];
  onClose: () => void;
  onSave: (payload: {
    plot: Omit<Plot, 'plot_id'>;
    initialListing?: {
      dealer_id: string;
      asking_price: number;
      price_unit: PriceUnit;
      description: string;
    };
  }) => Promise<void>;
}

export function NewPlotModal({
  isOpen,
  coordinates,
  defaultLocality,
  dealers,
  onClose,
  onSave,
}: NewPlotModalProps) {
  const [plotNumber, setPlotNumber] = useState('Plot 109, Block C');
  const [locality, setLocality] = useState(
    defaultLocality === 'All' ? LOCALITIES[0].name : defaultLocality
  );
  const [landmark, setLandmark] = useState('');
  const [areaSqYd, setAreaSqYd] = useState('220');
  const [dimensions, setDimensions] = useState('33 ft × 60 ft');
  const [facing, setFacing] = useState('East');
  const [boundarySource, setBoundarySource] = useState<BoundarySource>(
    'Illustrative Demo Boundary'
  );
  const [notes, setNotes] = useState('');

  const [addListing, setAddListing] = useState(true);
  const [dealerId, setDealerId] = useState(dealers[0]?.dealer_id ?? '');
  const [askingPrice, setAskingPrice] = useState('76000');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('Per Sq. Yd.');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plotNumber.trim() || coordinates.length < 3) return;
    setSubmitting(true);
    try {
      await onSave({
        plot: {
          plot_number: plotNumber.trim(),
          locality,
          address_landmark: landmark.trim() || `${plotNumber.trim()}, ${locality}`,
          coordinates,
          area_sqyd: Number(areaSqYd) || 200,
          dimensions: dimensions.trim() || '30 ft × 60 ft',
          facing,
          boundary_source: boundarySource,
          verification_status:
            boundarySource === 'Illustrative Demo Boundary' ? 'Illustrative Demo' : 'Verified',
          notes: notes.trim(),
        },
        initialListing:
          addListing && dealerId && Number(askingPrice) > 0
            ? {
                dealer_id: dealerId,
                asking_price: Number(askingPrice),
                price_unit: priceUnit,
                description: 'Newly mapped parcel listing.',
              }
            : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-plot-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-red-600 uppercase">
                  New Drawn Parcel ({coordinates.length} Vertices)
                </p>
                <h2 id="new-plot-modal-title" className="text-base font-bold text-slate-950">
                  Save Mapped Plot Boundary
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Plot Number</label>
                  <input
                    type="text"
                    required
                    value={plotNumber}
                    onChange={(e) => setPlotNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Locality</label>
                  <select
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  >
                    {LOCALITIES.map((l) => (
                      <option key={l.name} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Address / Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Sector 4 Park, Vaishali Nagar"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Area (sq. yd.)</label>
                  <input
                    type="number"
                    required
                    min={20}
                    value={areaSqYd}
                    onChange={(e) => setAreaSqYd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Dimensions</label>
                  <input
                    type="text"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Facing</label>
                  <select
                    value={facing}
                    onChange={(e) => setFacing(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  >
                    <option value="East">East</option>
                    <option value="North">North</option>
                    <option value="West">West</option>
                    <option value="South">South</option>
                    <option value="North-East Corner">North-East Corner</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Boundary Source</label>
                <select
                  value={boundarySource}
                  onChange={(e) => setBoundarySource(e.target.value as BoundarySource)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="Illustrative Demo Boundary">Illustrative Demo Boundary</option>
                  <option value="Surveyor Supplied">Surveyor Supplied</option>
                  <option value="Authorised Public Record">Authorised Public Record</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Road width, utilities, corner details..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={addListing}
                    onChange={(e) => setAddListing(e.target.checked)}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  Attach a For-Sale listing immediately (highlights parcel in red)
                </label>

                {addListing && (
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                    <select
                      value={dealerId}
                      onChange={(e) => setDealerId(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900"
                    >
                      {dealers.map((d) => (
                        <option key={d.dealer_id} value={d.dealer_id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1000}
                      value={askingPrice}
                      onChange={(e) => setAskingPrice(e.target.value)}
                      placeholder="Price (INR)"
                      className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-slate-900"
                    />
                    <select
                      value={priceUnit}
                      onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900"
                    >
                      <option value="Per Sq. Yd.">Per Sq. Yd.</option>
                      <option value="Total Price">Total Price</option>
                      <option value="Per Sq. Ft.">Per Sq. Ft.</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Plot Parcel'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
