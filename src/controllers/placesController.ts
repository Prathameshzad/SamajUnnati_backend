// src/controllers/placesController.ts
//
// Thin proxy over Google Places API (New) so the API key stays on the server.
// Used by the matrimony "Birth details" step to search a city within a state
// and then read its taluka + coordinates (needed later for the patrika).
//
// Requires "Places API (New)" to be enabled for GOOGLE_MAPS_API_KEY.
import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { badRequest } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('places');

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/';

function apiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Session tokens group autocomplete + details into one billed session. */
const sessionTokenOf = (v: unknown) => {
  const t = clean(v, 64);
  return /^[A-Za-z0-9_-]{8,64}$/.test(t) ? t : undefined;
};

/**
 * GET /api/matrimony/places/cities?q=pun&state=Maharashtra&sessionToken=...
 * → { data: [{ placeId, name, secondary }] }
 */
export async function searchCities(req: AuthRequest, res: Response) {
  const q = clean(req.query.q, 80);
  const state = clean(req.query.state, 60);
  if (q.length < 2) return res.json({ status: 'success', data: [] });

  const key = apiKey();
  if (!key) {
    return res.status(503).json({ status: 'error', code: 'PLACES_UNAVAILABLE', message: 'City search is not configured' });
  }

  try {
    const r = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({
        // Biasing the text with the state keeps results inside it.
        input: state ? `${q}, ${state}` : q,
        includedRegionCodes: ['in'],
        includedPrimaryTypes: ['locality', 'administrative_area_level_3', 'sublocality_level_1'],
        languageCode: 'en',
        sessionToken: sessionTokenOf(req.query.sessionToken),
      }),
    });
    const json: any = await r.json();
    if (!r.ok) {
      log.warn({ status: r.status, error: json?.error?.message }, 'places autocomplete failed');
      return res.status(503).json({ status: 'error', code: 'PLACES_UNAVAILABLE', message: 'City search is unavailable right now' });
    }

    const stateLc = state.toLowerCase();
    const data = (json.suggestions ?? [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({
        placeId: p.placeId as string,
        name: (p.structuredFormat?.mainText?.text ?? p.text?.text ?? '') as string,
        secondary: (p.structuredFormat?.secondaryText?.text ?? '') as string,
      }))
      // Keep only results in the chosen state (when Google tells us the state).
      .filter((p: any) => !stateLc || !p.secondary || p.secondary.toLowerCase().includes(stateLc))
      .slice(0, 8);

    return res.json({ status: 'success', data });
  } catch (err) {
    log.error({ err }, 'places autocomplete error');
    return res.status(503).json({ status: 'error', code: 'PLACES_UNAVAILABLE', message: 'City search is unavailable right now' });
  }
}

/**
 * GET /api/matrimony/places/:placeId?sessionToken=...
 * → { data: { placeId, city, taluka, district, state, lat, lng, formattedAddress } }
 */
export async function getPlaceDetails(req: AuthRequest, res: Response) {
  const placeId = clean(req.params.placeId, 300);
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) throw badRequest('Invalid place id');

  const key = apiKey();
  if (!key) {
    return res.status(503).json({ status: 'error', code: 'PLACES_UNAVAILABLE', message: 'City search is not configured' });
  }

  try {
    const token = sessionTokenOf(req.query.sessionToken);
    const url = `${DETAILS_URL}${encodeURIComponent(placeId)}?languageCode=en${token ? `&sessionToken=${token}` : ''}`;
    const r = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
      },
    });
    const json: any = await r.json();
    if (!r.ok) {
      log.warn({ status: r.status, error: json?.error?.message }, 'place details failed');
      return res.status(503).json({ status: 'error', code: 'PLACES_UNAVAILABLE', message: 'Could not load that place' });
    }

    const comps: any[] = json.addressComponents ?? [];
    const byType = (t: string) => comps.find((c) => (c.types ?? []).includes(t))?.longText ?? null;

    return res.json({
      status: 'success',
      data: {
        placeId,
        city: byType('locality') ?? json.displayName?.text ?? null,
        // In India Google maps the taluka / tehsil to admin level 3.
        taluka: byType('administrative_area_level_3'),
        district: byType('administrative_area_level_2'),
        state: byType('administrative_area_level_1'),
        lat: json.location?.latitude ?? null,
        lng: json.location?.longitude ?? null,
        formattedAddress: json.formattedAddress ?? null,
      },
    });
  } catch (err) {
    log.error({ err }, 'place details error');
    return res.status(503).json({ status: 'error', code: 'PLACES_UNAVAILABLE', message: 'Could not load that place' });
  }
}
