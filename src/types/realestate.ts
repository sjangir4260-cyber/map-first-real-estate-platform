export type AvailabilityStatus = 'For Sale' | 'Reserved' | 'Sold' | 'Unverified';
export type PriceUnit = 'Total Price' | 'Per Sq. Yd.' | 'Per Sq. Ft.';
export type BoundarySource =
  | 'Illustrative Demo Boundary'
  | 'Surveyor Supplied'
  | 'Authorised Public Record';
export type VerificationStatus = 'Illustrative Demo' | 'Verified' | 'Unverified';

export interface Plot {
  plot_id: string;
  plot_number: string;
  locality: string;
  address_landmark: string;
  coordinates: [number, number][];
  area_sqyd: number;
  dimensions: string;
  facing: string;
  boundary_source: BoundarySource;
  verification_status: VerificationStatus;
  notes: string;
}

export interface Dealer {
  dealer_id: string;
  name: string;
  agency: string;
  phone: string;
  email: string;
  consent_to_publish: boolean;
  account_status: 'Active' | 'Pending' | 'Suspended';
  locality_focus: string;
}

export interface Listing {
  listing_id: string;
  plot_id: string;
  dealer_id: string;
  asking_price: number;
  price_unit: PriceUnit;
  availability_status: AvailabilityStatus;
  approval_status: 'Approved' | 'Pending';
  description: string;
  updated_at: string;
}

export interface Enquiry {
  enquiry_id: string;
  listing_id: string;
  plot_id: string;
  dealer_id: string;
  sender_name: string;
  sender_contact: string;
  message: string;
  created_at: string;
}

export interface DatabaseState {
  plots: Plot[];
  dealers: Dealer[];
  listings: Listing[];
  enquiries: Enquiry[];
}

export const LOCALITIES: {
  name: string;
  center: [number, number];
  zoom: number;
}[] = [
  { name: 'Vaishali Nagar', center: [26.9124, 75.7445], zoom: 17 },
  { name: 'Malviya Nagar', center: [26.8548, 75.8142], zoom: 17 },
  { name: 'Jagatpura Sector 7', center: [26.8265, 75.8542], zoom: 17 },
];

export function computeEstimatedTotalInr(
  listing: Pick<Listing, 'asking_price' | 'price_unit'>,
  areaSqYd: number
): number {
  if (listing.price_unit === 'Total Price') {
    return listing.asking_price;
  }
  if (listing.price_unit === 'Per Sq. Yd.') {
    return listing.asking_price * areaSqYd;
  }
  // 1 sq. yd. = 9 sq. ft.
  return listing.asking_price * areaSqYd * 9;
}

export function formatInr(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function derivePlotStatus(
  plotId: string,
  listings: Listing[],
  includePending = false
): AvailabilityStatus {
  const relevant = listings.filter(
    (l) => l.plot_id === plotId && (includePending || l.approval_status === 'Approved')
  );
  if (relevant.some((l) => l.availability_status === 'For Sale')) return 'For Sale';
  if (relevant.some((l) => l.availability_status === 'Reserved')) return 'Reserved';
  if (relevant.some((l) => l.availability_status === 'Sold')) return 'Sold';
  return 'Unverified';
}

export const STATUS_MAP_STYLE: Record<
  AvailabilityStatus,
  {
    color: string;
    fillColor: string;
    fillOpacity: number;
    dashArray?: string;
    textClass: string;
    dotClass: string;
  }
> = {
  'For Sale': {
    color: '#B91C1C',
    fillColor: '#DC2626',
    fillOpacity: 0.45,
    textClass: 'text-red-700',
    dotClass: 'bg-red-600',
  },
  Reserved: {
    color: '#B45309',
    fillColor: '#D97706',
    fillOpacity: 0.36,
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
  },
  Sold: {
    color: '#475569',
    fillColor: '#64748B',
    fillOpacity: 0.32,
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-500',
  },
  Unverified: {
    color: '#57534E',
    fillColor: '#A8A29E',
    fillOpacity: 0.22,
    dashArray: '5, 5',
    textClass: 'text-stone-600',
    dotClass: 'bg-stone-400',
  },
};
