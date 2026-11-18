import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { SEED_DATA } from './src/data/seedData.ts';
import type { DatabaseState, Dealer, Enquiry, Listing, Plot } from './src/types/realestate.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'realestate-db.json');

function ensureDb(): DatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(SEED_DATA, null, 2), 'utf-8');
    return structuredClone(SEED_DATA);
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseState;
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(SEED_DATA, null, 2), 'utf-8');
    return structuredClone(SEED_DATA);
  }
}

function saveDb(state: DatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Load initial DB
  let db = ensureDb();

  app.get('/api/state', (_req: Request, res: Response) => {
    db = ensureDb();
    res.json(db);
  });

  app.post('/api/plots', (req: Request, res: Response) => {
    const body = req.body as Partial<Plot>;
    if (
      !body.plot_number ||
      !body.locality ||
      !Array.isArray(body.coordinates) ||
      body.coordinates.length < 3
    ) {
      res.status(400).json({ error: 'Plot number, locality, and at least 3 coordinates are required.' });
      return;
    }

    const newPlot: Plot = {
      plot_id: body.plot_id?.trim() || `PLT-${Date.now().toString().slice(-5)}`,
      plot_number: body.plot_number.trim(),
      locality: body.locality.trim(),
      address_landmark: body.address_landmark?.trim() || body.locality.trim(),
      coordinates: body.coordinates,
      area_sqyd: Number(body.area_sqyd) || 200,
      dimensions: body.dimensions?.trim() || '30 ft × 60 ft',
      facing: body.facing?.trim() || 'East',
      boundary_source: body.boundary_source || 'Illustrative Demo Boundary',
      verification_status: body.verification_status || 'Illustrative Demo',
      notes: body.notes?.trim() || '',
    };

    db.plots.push(newPlot);
    saveDb(db);
    res.status(201).json(newPlot);
  });

  app.put('/api/plots/:id', (req: Request, res: Response) => {
    const plotId = req.params.id;
    const idx = db.plots.findIndex((p) => p.plot_id === plotId);
    if (idx === -1) {
      res.status(404).json({ error: 'Plot not found.' });
      return;
    }
    const existing = db.plots[idx];
    const patch = req.body as Partial<Plot>;
    const updated: Plot = {
      ...existing,
      ...patch,
      plot_id: existing.plot_id,
    };
    db.plots[idx] = updated;
    saveDb(db);
    res.json(updated);
  });

  app.post('/api/listings', (req: Request, res: Response) => {
    const body = req.body as Partial<Listing>;
    if (!body.plot_id || !body.dealer_id || !body.asking_price) {
      res.status(400).json({ error: 'Plot, dealer, and asking price are required.' });
      return;
    }
    const newListing: Listing = {
      listing_id: `LST-${Date.now().toString().slice(-5)}`,
      plot_id: body.plot_id,
      dealer_id: body.dealer_id,
      asking_price: Number(body.asking_price),
      price_unit: body.price_unit || 'Total Price',
      availability_status: body.availability_status || 'For Sale',
      approval_status: body.approval_status || 'Approved',
      description: body.description?.trim() || '',
      updated_at: new Date().toISOString().slice(0, 10),
    };
    db.listings.unshift(newListing);
    saveDb(db);
    res.status(201).json(newListing);
  });

  app.put('/api/listings/:id', (req: Request, res: Response) => {
    const listingId = req.params.id;
    const idx = db.listings.findIndex((l) => l.listing_id === listingId);
    if (idx === -1) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }
    const existing = db.listings[idx];
    const patch = req.body as Partial<Listing>;
    const updated: Listing = {
      ...existing,
      ...patch,
      listing_id: existing.listing_id,
      updated_at: new Date().toISOString().slice(0, 10),
    };
    db.listings[idx] = updated;
    saveDb(db);
    res.json(updated);
  });

  app.delete('/api/listings/:id', (req: Request, res: Response) => {
    const listingId = req.params.id;
    const nextListings = db.listings.filter((l) => l.listing_id !== listingId);
    if (nextListings.length === db.listings.length) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }
    db.listings = nextListings;
    saveDb(db);
    res.json({ deleted: listingId });
  });

  app.post('/api/dealers', (req: Request, res: Response) => {
    const body = req.body as Partial<Dealer>;
    if (!body.name || !body.phone) {
      res.status(400).json({ error: 'Dealer name and phone are required.' });
      return;
    }
    const newDealer: Dealer = {
      dealer_id: `DLR-${Date.now().toString().slice(-4)}`,
      name: body.name.trim(),
      agency: body.agency?.trim() || 'Independent Owner',
      phone: body.phone.trim(),
      email: body.email?.trim() || '',
      consent_to_publish: Boolean(body.consent_to_publish),
      account_status: body.account_status || 'Active',
      locality_focus: body.locality_focus?.trim() || 'Vaishali Nagar',
    };
    db.dealers.push(newDealer);
    saveDb(db);
    res.status(201).json(newDealer);
  });

  app.put('/api/dealers/:id', (req: Request, res: Response) => {
    const dealerId = req.params.id;
    const idx = db.dealers.findIndex((d) => d.dealer_id === dealerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Dealer not found.' });
      return;
    }
    db.dealers[idx] = { ...db.dealers[idx], ...(req.body as Partial<Dealer>), dealer_id: dealerId };
    saveDb(db);
    res.json(db.dealers[idx]);
  });

  app.post('/api/enquiries', (req: Request, res: Response) => {
    const body = req.body as Partial<Enquiry>;
    if (!body.listing_id || !body.plot_id || !body.sender_name || !body.sender_contact) {
      res.status(400).json({ error: 'Name and contact info are required to send an enquiry.' });
      return;
    }
    const newEnquiry: Enquiry = {
      enquiry_id: `ENQ-${Date.now().toString().slice(-5)}`,
      listing_id: body.listing_id,
      plot_id: body.plot_id,
      dealer_id: body.dealer_id || '',
      sender_name: body.sender_name.trim(),
      sender_contact: body.sender_contact.trim(),
      message: body.message?.trim() || 'Interested in this plot listing.',
      created_at: new Date().toISOString(),
    };
    db.enquiries.unshift(newEnquiry);
    saveDb(db);
    res.status(201).json(newEnquiry);
  });

  app.post('/api/reset-demo', (_req: Request, res: Response) => {
    db = structuredClone(SEED_DATA);
    saveDb(db);
    res.json(db);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlotLedger server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
