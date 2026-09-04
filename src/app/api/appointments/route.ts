import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { corsOptions, json, errorResponse } from '@/lib/cors';
import { ANY_MECHANIC, pickFreeMechanic } from '@/lib/mechanic-slots';
import type { CreateAppointmentRequest } from '@/types/auto-service.types';

// Columns readable via the anon/authenticated role after the 2026-08-26 RLS
// hardening (column-level GRANT excludes customer PII -- name/phone/email/
// vehicle plate/mileage/problem description). `select('*')` or `.select()`
// with no args fails outright under a partial column grant, so every read
// here must name exactly the columns this route actually needs.
const APPOINTMENT_SAFE_COLUMNS =
  'id, confirmation_number, status, mechanic_id, service_id, vehicle_make, vehicle_model, vehicle_year, slot_date, slot_start_time, idempotency_key';

export async function OPTIONS(): Promise<Response> {
  return corsOptions();
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as CreateAppointmentRequest;
    const validationError = validateRequest(body);
    if (validationError) {
      return errorResponse(validationError);
    }

    const idempotencyKey = req.headers.get('X-Idempotency-Key');
    if (idempotencyKey) {
      const existing = await findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return json(existing);
      }
    }

    // "Any mechanic": assign the first mechanic (for the service) who is working
    // and free at that time — the slot list the widget offered was their union.
    const mechanicId = body.mechanicId === ANY_MECHANIC
      ? await pickFreeMechanic(body.serviceId, body.slotDate, body.slotStartTime)
      : body.mechanicId;
    if (!mechanicId) {
      return errorResponse('No mechanic is free at this time', 409);
    }
    const resolved: CreateAppointmentRequest = { ...body, mechanicId };

    const isAvailable = await checkSlotAvailable(resolved.mechanicId, resolved.slotDate, resolved.slotStartTime);
    if (!isAvailable) {
      return errorResponse('This time slot is no longer available', 409);
    }

    const appointment = await createAppointment(resolved, idempotencyKey);
    return json(appointment, 201);
  } catch (err) {
    console.error('[api/appointments] Error:', err);
    return errorResponse('Internal server error', 500);
  }
}

function validateRequest(body: CreateAppointmentRequest): string | null {
  if (!body.mechanicId) { return 'mechanicId is required'; }
  if (!body.serviceId) { return 'serviceId is required'; }
  if (!body.slotDate) { return 'slotDate is required'; }
  if (!body.slotStartTime) { return 'slotStartTime is required'; }
  if (!body.customer?.firstName) { return 'customer.firstName is required'; }
  if (!body.customer?.phone) { return 'customer.phone is required'; }
  if (!body.vehicle?.make) { return 'vehicle.make is required'; }
  return null;
}

async function findByIdempotencyKey(key: string): Promise<unknown | null> {
  const { data } = await getSupabase()
    .from('appointments')
    .select(APPOINTMENT_SAFE_COLUMNS)
    .eq('idempotency_key', key)
    .single();
  return data ? buildResponse(data) : null;
}

async function checkSlotAvailable(mechanicId: string, date: string, time: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from('appointments')
    .select('id')
    .eq('mechanic_id', mechanicId)
    .eq('slot_date', date)
    .eq('slot_start_time', time)
    .neq('status', 'cancelled');
  return !data || data.length === 0;
}

function generateId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `APT-${dateStr}-${rand}`;
}

function generateConfirmation(): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CONF-${rand}`;
}

async function createAppointment(
  body: CreateAppointmentRequest,
  idempotencyKey: string | null,
): Promise<unknown> {
  const id = generateId();
  const confirmation = generateConfirmation();
  const endTime = addHour(body.slotStartTime);

  const row = {
    id,
    confirmation_number: confirmation,
    mechanic_id: body.mechanicId,
    service_id: body.serviceId,
    selected_option_id: body.selectedOptionId || null,
    slot_date: body.slotDate,
    slot_start_time: body.slotStartTime,
    slot_end_time: endTime,
    vehicle_make: body.vehicle.make,
    vehicle_model: body.vehicle.model,
    vehicle_year: body.vehicle.year,
    license_plate: body.vehicle.licensePlate,
    mileage: body.vehicle.mileage,
    customer_first_name: body.customer.firstName,
    customer_last_name: body.customer.lastName,
    customer_email: body.customer.email,
    customer_phone: body.customer.phone,
    problem_description: body.problemDescription || null,
    urgency: body.urgency || 'normal',
    contact_method: body.contactMethod || 'phone',
    idempotency_key: idempotencyKey,
  };

  const { data, error } = await getSupabase()
    .from('appointments')
    .insert(row)
    .select(APPOINTMENT_SAFE_COLUMNS)
    .single();

  if (error) {
    throw new Error(`DB insert failed: ${error.message}`);
  }

  return buildResponse(data);
}

interface AppointmentRow {
  id: string;
  confirmation_number: string;
  status: string;
  mechanic_id: string;
  service_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  slot_date: string;
  slot_start_time: string;
}

function buildResponse(row: AppointmentRow): unknown {
  return {
    appointmentId: row.id,
    confirmationNumber: row.confirmation_number,
    status: row.status || 'pending',
    message: 'Appointment booked successfully',
    details: {
      mechanic: { id: row.mechanic_id },
      service: { id: row.service_id },
      vehicle: { make: row.vehicle_make, model: row.vehicle_model, year: row.vehicle_year },
      dateTime: `${row.slot_date}T${row.slot_start_time}`,
    },
  };
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
