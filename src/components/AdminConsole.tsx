import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import {
  AvailabilityStatus,
  BoundarySource,
  Dealer,
  Enquiry,
  LOCALITIES,
  Listing,
  Plot,
  PriceUnit,
  formatInr,
} from '../types/realestate';

interface AdminConsoleProps {
  plots: Plot[];
  dealers: Dealer[];
  listings: Listing[];
  enquiries: Enquiry[];
  onStartDrawOnMap: () => void;
  onUpdatePlot: (plotId: string, patch: Partial<Plot>) => Promise<void>;
  onCreateListing: (payload: Omit<Listing, 'listing_id' | 'updated_at'>) => Promise<void>;
  onUpdateListing: (listingId: string, patch: Partial<Listing>) => Promise<void>;
  onDeleteListing: (listingId: string) => Promise<void>;
  onCreateDealer: (payload: Omit<Dealer, 'dealer_id'>) => Promise<void>;
  onUpdateDealer: (dealerId: string, patch: Partial<Dealer>) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

export function AdminConsole({
  plots,
  dealers,
  listings,
  enquiries,
  onStartDrawOnMap,
  onUpdatePlot,
  onCreateListing,
  onUpdateListing,
  onDeleteListing,
  onCreateDealer,
  onUpdateDealer,
  onResetDemo,
}: AdminConsoleProps) {
  const [role, setRole] = useState<'Administrator' | 'Dealer'>('Administrator');
  const [tab, setTab] = useState<'listings' | 'plots' | 'dealers' | 'enquiries'>('listings');

  // Add listing form state
  const [newListingPlotId, setNewListingPlotId] = useState(plots[0]?.plot_id ?? '');
  const [newListingDealerId, setNewListingDealerId] = useState(dealers[0]?.dealer_id ?? '');
  const [newListingPrice, setNewListingPrice] = useState('75000');
  const [newListingUnit, setNewListingUnit] = useState<PriceUnit>('Per Sq. Yd.');
  const [newListingStatus, setNewListingStatus] = useState<AvailabilityStatus>('For Sale');
  const [newListingDesc, setNewListingDesc] = useState('');

  // Add dealer form state
  const [dealerName, setDealerName] = useState('');
  const [dealerAgency, setDealerAgency] = useState('');
  const [dealerPhone, setDealerPhone] = useState('');
  const [dealerEmail, setDealerEmail] = useState('');
  const [dealerLocality, setDealerLocality] = useState(LOCALITIES[0].name);
  const [dealerConsent, setDealerConsent] = useState(true);

  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [editPlotArea, setEditPlotArea] = useState('');
  const [editPlotDimensions, setEditPlotDimensions] = useState('');
  const [editPlotSource, setEditPlotSource] = useState<BoundarySource>('Illustrative Demo Boundary');
  const [editPlotNotes, setEditPlotNotes] = useState('');

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListingPlotId || !newListingDealerId || !Number(newListingPrice)) return;
    await onCreateListing({
      plot_id: newListingPlotId,
      dealer_id: newListingDealerId,
      asking_price: Number(newListingPrice),
      price_unit: newListingUnit,
      availability_status: newListingStatus,
      approval_status: role === 'Administrator' ? 'Approved' : 'Pending',
      description: newListingDesc || 'Submitted via console.',
    });
    setNewListingDesc('');
  };

  const handleAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealerName.trim() || !dealerPhone.trim()) return;
    await onCreateDealer({
      name: dealerName,
      agency: dealerAgency || 'Independent Owner',
      phone: dealerPhone,
      email: dealerEmail,
      consent_to_publish: dealerConsent,
      account_status: 'Active',
      locality_focus: dealerLocality,
    });
    setDealerName('');
    setDealerAgency('');
    setDealerPhone('');
    setDealerEmail('');
  };

  const startEditPlot = (plot: Plot) => {
    setEditingPlotId(plot.plot_id);
    setEditPlotArea(String(plot.area_sqyd));
    setEditPlotDimensions(plot.dimensions);
    setEditPlotSource(plot.boundary_source);
    setEditPlotNotes(plot.notes);
  };

  const saveEditPlot = async (plotId: string) => {
    await onUpdatePlot(plotId, {
      area_sqyd: Number(editPlotArea) || 200,
      dimensions: editPlotDimensions,
      boundary_source: editPlotSource,
      verification_status:
        editPlotSource === 'Illustrative Demo Boundary' ? 'Illustrative Demo' : 'Verified',
      notes: editPlotNotes,
    });
    setEditingPlotId(null);
  };

  const pendingCount = listings.filter((l) => l.approval_status === 'Pending').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="mx-auto max-w-6xl px-6 py-8"
    >
      {/* Header + Role Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Operations &amp; Persistence Console
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Admin &amp; Dealer Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Changes persist to the backend database across page refreshes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            {(['Administrator', 'Dealer'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  role === r
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r} Role
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onStartDrawOnMap}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
          >
            <Pencil className="h-3.5 w-3.5" />
            Draw New Plot on Map
          </button>

          {role === 'Administrator' && (
            <button
              type="button"
              onClick={onResetDemo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Demo Data
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'listings' as const, label: `Listings (${listings.length})`, extra: pendingCount > 0 ? `${pendingCount} pending` : null },
          { id: 'plots' as const, label: `Plots (${plots.length})`, extra: null },
          { id: 'dealers' as const, label: `Dealers (${dealers.length})`, extra: null },
          { id: 'enquiries' as const, label: `Buyer Enquiries (${enquiries.length})`, extra: null },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>{item.label}</span>
            {item.extra && (
              <span className={tab === item.id ? 'text-amber-300' : 'text-amber-600'}>
                · {item.extra}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: LISTINGS */}
      {tab === 'listings' && (
        <div className="mt-6 space-y-6">
          <form
            onSubmit={handleAddListing}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-sm font-bold text-slate-900">
              Add Buy–Sell Listing ({role === 'Dealer' ? 'Submits as Pending Approval' : 'Publishes Immediately'})
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <select
                value={newListingPlotId}
                onChange={(e) => setNewListingPlotId(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              >
                {plots.map((p) => (
                  <option key={p.plot_id} value={p.plot_id}>
                    {p.plot_id} — {p.locality}
                  </option>
                ))}
              </select>

              <select
                value={newListingDealerId}
                onChange={(e) => setNewListingDealerId(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              >
                {dealers.map((d) => (
                  <option key={d.dealer_id} value={d.dealer_id}>
                    {d.name} ({d.agency})
                  </option>
                ))}
              </select>

              <input
                type="number"
                required
                min={1000}
                value={newListingPrice}
                onChange={(e) => setNewListingPrice(e.target.value)}
                placeholder="Asking price (INR)"
                className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
              />

              <select
                value={newListingUnit}
                onChange={(e) => setNewListingUnit(e.target.value as PriceUnit)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              >
                <option value="Total Price">Total Price</option>
                <option value="Per Sq. Yd.">Per Sq. Yd.</option>
                <option value="Per Sq. Ft.">Per Sq. Ft.</option>
              </select>

              <select
                value={newListingStatus}
                onChange={(e) => setNewListingStatus(e.target.value as AvailabilityStatus)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              >
                <option value="For Sale">For Sale</option>
                <option value="Reserved">Reserved</option>
                <option value="Sold">Sold</option>
                <option value="Unverified">Unverified</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <input
                type="text"
                value={newListingDesc}
                onChange={(e) => setNewListingDesc(e.target.value)}
                placeholder="Notes (e.g. JDA patta verified, immediate registry)"
                className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Save Listing
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  <th className="px-4 py-3">Listing / Plot</th>
                  <th className="px-4 py-3">Dealer</th>
                  <th className="px-4 py-3">Quoted Price</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map((l) => {
                  const dealer = dealers.find((d) => d.dealer_id === l.dealer_id);
                  return (
                    <tr key={l.listing_id} className="hover:bg-slate-50/75">
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-slate-900">{l.plot_id}</div>
                        <div className="text-[11px] text-slate-500">{l.listing_id}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{dealer?.name ?? l.dealer_id}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                        {formatInr(l.asking_price)} · {l.price_unit}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={l.availability_status}
                          onChange={(e) =>
                            onUpdateListing(l.listing_id, {
                              availability_status: e.target.value as AvailabilityStatus,
                            })
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                        >
                          <option value="For Sale">For Sale</option>
                          <option value="Reserved">Reserved</option>
                          <option value="Sold">Sold</option>
                          <option value="Unverified">Unverified</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            l.approval_status === 'Approved' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {l.approval_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {role === 'Administrator' && l.approval_status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateListing(l.listing_id, { approval_status: 'Approved' })
                              }
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                            >
                              <Check className="h-3 w-3" />
                              Approve
                            </button>
                          )}
                          {role === 'Administrator' && (
                            <button
                              type="button"
                              onClick={() => onDeleteListing(l.listing_id)}
                              title="Remove listing"
                              className="rounded border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PLOTS */}
      {tab === 'plots' && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="px-4 py-3">Plot ID</th>
                <th className="px-4 py-3">Locality &amp; Number</th>
                <th className="px-4 py-3">Area &amp; Dimensions</th>
                <th className="px-4 py-3">Boundary Source</th>
                <th className="px-4 py-3 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plots.map((plot) => {
                const isEditing = editingPlotId === plot.plot_id;
                return (
                  <tr key={plot.plot_id} className="hover:bg-slate-50/75">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {plot.plot_id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{plot.plot_number}</div>
                      <div className="text-[11px] text-slate-500">{plot.locality}</div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={editPlotArea}
                            onChange={(e) => setEditPlotArea(e.target.value)}
                            className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                          />
                          <input
                            type="text"
                            value={editPlotDimensions}
                            onChange={(e) => setEditPlotDimensions(e.target.value)}
                            className="w-28 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-slate-700 tabular-nums">
                          {plot.area_sqyd} sq.yd · {plot.dimensions}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <select
                            value={editPlotSource}
                            onChange={(e) => setEditPlotSource(e.target.value as BoundarySource)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="Illustrative Demo Boundary">Illustrative Demo Boundary</option>
                            <option value="Surveyor Supplied">Surveyor Supplied</option>
                            <option value="Authorised Public Record">Authorised Public Record</option>
                          </select>
                          <input
                            type="text"
                            value={editPlotNotes}
                            onChange={(e) => setEditPlotNotes(e.target.value)}
                            placeholder="Parcel notes"
                            className="block w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-slate-800">{plot.boundary_source}</div>
                          <div className="text-[11px] text-slate-500">{plot.verification_status}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEditPlot(plot.plot_id)}
                            className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPlotId(null)}
                            className="rounded border border-slate-300 px-2 py-1 text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditPlot(plot)}
                          className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: DEALERS */}
      {tab === 'dealers' && (
        <div className="mt-6 space-y-6">
          <form
            onSubmit={handleAddDealer}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-sm font-bold text-slate-900">Register Dealer or Plot Owner</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input
                type="text"
                required
                placeholder="Full name"
                value={dealerName}
                onChange={(e) => setDealerName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Agency (or Independent Owner)"
                value={dealerAgency}
                onChange={(e) => setDealerAgency(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                placeholder="Phone number"
                value={dealerPhone}
                onChange={(e) => setDealerPhone(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={dealerEmail}
                onChange={(e) => setDealerEmail(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <select
                value={dealerLocality}
                onChange={(e) => setDealerLocality(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                {LOCALITIES.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={dealerConsent}
                  onChange={(e) => setDealerConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                Consent granted to publish phone/email publicly
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Dealer
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  <th className="px-4 py-3">Dealer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Publish Consent</th>
                  <th className="px-4 py-3">Account Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dealers.map((d) => (
                  <tr key={d.dealer_id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{d.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {d.dealer_id} · {d.agency}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{d.phone}</div>
                      <div className="text-[11px] text-slate-500">{d.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateDealer(d.dealer_id, {
                            consent_to_publish: !d.consent_to_publish,
                          })
                        }
                        className={`rounded border px-2.5 py-1 text-[11px] font-medium ${
                          d.consent_to_publish
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {d.consent_to_publish ? 'Publicly Visible' : 'Hidden (Private)'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={d.account_status}
                        onChange={(e) =>
                          onUpdateDealer(d.dealer_id, {
                            account_status: e.target.value as Dealer['account_status'],
                          })
                        }
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ENQUIRIES */}
      {tab === 'enquiries' && (
        <div className="mt-6 space-y-3">
          {enquiries.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No buyer enquiries submitted yet.
            </div>
          ) : (
            enquiries.map((enq) => (
              <div
                key={enq.enquiry_id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-800">
                    {enq.enquiry_id} · {enq.plot_id} · {enq.listing_id}
                  </span>
                  <span className="tabular-nums">
                    {new Date(enq.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">
                  {enq.sender_name}{' '}
                  <span className="font-normal text-slate-600">({enq.sender_contact})</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{enq.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
}
