import { getSupabase } from '@/lib/supabase';

/** Sentinel the booking widget sends when the customer does not care which mechanic. */
export const ANY_MECHANIC = 'any';

const SLOT_DURATION_MIN = 60;

export type Slot = { id: string; startTime: string; endTime: string; status: string };

interface ScheduleRow {
  start_time: string;
  end_time: string;
  is_working: boolean;
}

interface BreakRow {
  start_time: string;
  end_time: string;
}

/** Free/booked slots of one mechanic on one date (empty when not working). */
export async function slotsForMechanic(mechanicId: string, date: string): Promise<Slot[]> {
  const dayOfWeek = new Date(date).getDay();
  const [schedule, breaks, booked] = await Promise.all([
    getSchedule(mechanicId, dayOfWeek),
    getBreaks(mechanicId, dayOfWeek),
    getBookedSlots(mechanicId, date),
  ]);
  if (!schedule?.is_working) {
    return [];
  }
  return generateSlots(schedule, breaks, booked, date);
}

/** Active mechanics — those offering the service when a serviceId is given. */
export async function getMechanicIds(serviceId: string | null | undefined): Promise<string[]> {
  if (serviceId) {
    // The join table has no status of its own — a retired mechanic keeps its
    // service rows, so the active flag must come from `mechanics` (inner join).
    const { data } = await getSupabase()
      .from('mechanic_services')
      .select('mechanic_id, mechanics!inner(is_active)')
      .eq('service_id', serviceId)
      .eq('mechanics.is_active', true);
    return (data ?? []).map((r) => r.mechanic_id as string);
  }
  const { data } = await getSupabase().from('mechanics').select('id').eq('is_active', true);
  return (data ?? []).map((r) => r.id as string);
}

/** One slot per start time; available if any mechanic has it free. */
export function mergeSlots(perMechanic: Slot[][]): Slot[] {
  const byStart = new Map<string, Slot>();
  for (const slots of perMechanic) {
    for (const slot of slots) {
      const existing = byStart.get(slot.startTime);
      if (!existing || (existing.status !== 'available' && slot.status === 'available')) {
        byStart.set(slot.startTime, slot);
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * "Any mechanic": the first mechanic (for the service) who is working and free
 * at the requested start time, or null when nobody is.
 */
export async function pickFreeMechanic(
  serviceId: string | null | undefined,
  date: string,
  startTime: string,
): Promise<string | null> {
  for (const mechanicId of await getMechanicIds(serviceId)) {
    const slots = await slotsForMechanic(mechanicId, date);
    if (slots.some((s) => s.startTime === startTime && s.status === 'available')) {
      return mechanicId;
    }
  }
  return null;
}

async function getSchedule(mechanicId: string, dow: number): Promise<ScheduleRow | null> {
  const { data } = await getSupabase()
    .from('schedules')
    .select('start_time, end_time, is_working')
    .eq('mechanic_id', mechanicId)
    .eq('day_of_week', dow)
    .single();
  return data;
}

async function getBreaks(mechanicId: string, dow: number): Promise<BreakRow[]> {
  const { data } = await getSupabase()
    .from('schedule_breaks')
    .select('start_time, end_time')
    .eq('mechanic_id', mechanicId)
    .eq('day_of_week', dow);
  return data ?? [];
}

async function getBookedSlots(mechanicId: string, date: string): Promise<string[]> {
  const { data } = await getSupabase()
    .from('appointments')
    .select('slot_start_time')
    .eq('mechanic_id', mechanicId)
    .eq('slot_date', date)
    .neq('status', 'cancelled');
  return (data ?? []).map((r) => r.slot_start_time);
}

function generateSlots(schedule: ScheduleRow, breaks: BreakRow[], booked: string[], date: string): Slot[] {
  const slots: Slot[] = [];
  let current = toMinutes(schedule.start_time);
  const end = toMinutes(schedule.end_time);

  while (current + SLOT_DURATION_MIN <= end) {
    const startStr = fromMinutes(current);
    const endStr = fromMinutes(current + SLOT_DURATION_MIN);

    if (!isDuringBreak(current, current + SLOT_DURATION_MIN, breaks)) {
      const status = booked.includes(startStr) ? 'booked' : 'available';
      slots.push({ id: `${date}_${startStr}`, startTime: startStr, endTime: endStr, status });
    }

    current += SLOT_DURATION_MIN;
  }

  return slots;
}

function isDuringBreak(start: number, end: number, breaks: BreakRow[]): boolean {
  return breaks.some((b) => {
    const bStart = toMinutes(b.start_time);
    const bEnd = toMinutes(b.end_time);
    return start < bEnd && end > bStart;
  });
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
