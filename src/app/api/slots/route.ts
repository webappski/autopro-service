import { NextRequest } from 'next/server';
import { corsOptions, json, errorResponse } from '@/lib/cors';
import { ANY_MECHANIC, getMechanicIds, mergeSlots, slotsForMechanic } from '@/lib/mechanic-slots';

export async function OPTIONS(): Promise<Response> {
  return corsOptions();
}

/**
 * GET /api/slots?date=YYYY-MM-DD&mechanicId=<id|any>[&serviceId=<id>]
 *
 * With a concrete mechanicId: that mechanic's slots. With `any` (or no
 * mechanicId): the union of every mechanic's free slots — for the service when
 * serviceId is given — so the booking widget can offer "any mechanic".
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const mechanicId = req.nextUrl.searchParams.get('mechanicId');
    const serviceId = req.nextUrl.searchParams.get('serviceId');
    const date = req.nextUrl.searchParams.get('date');

    if (!date) {
      return errorResponse('date is required');
    }

    if (!mechanicId || mechanicId === ANY_MECHANIC) {
      const mechanicIds = await getMechanicIds(serviceId);
      const perMechanic = await Promise.all(mechanicIds.map((id) => slotsForMechanic(id, date)));
      return json({ slots: mergeSlots(perMechanic) });
    }

    return json({ slots: await slotsForMechanic(mechanicId, date) });
  } catch (err) {
    console.error('[api/slots] Error:', err);
    return errorResponse('Internal server error', 500);
  }
}
