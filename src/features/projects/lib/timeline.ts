import { supabase } from '@/shared/lib/supabase';
import type {
  CreateTimelineEventInput,
  ProjectTimelineEvent,
  TimelineEventType,
  TimelineVisibility,
} from '@/features/portal/model/project-portal.types';

// ─── Wołanie DB function create_timeline_event() ────────────────────────────

export async function createTimelineEvent(
  input: CreateTimelineEventInput,
): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('create_timeline_event', {
    p_company_id:     input.company_id,
    p_project_id:     input.project_id,
    p_event_type:     input.event_type,
    p_visibility:     input.visibility,
    p_title:          input.title,
    p_description:    input.description      ?? null,
    p_actor_type:     input.actor_type       ?? 'operator',
    p_actor_id:       input.actor_id         ?? null,
    p_actor_name:     input.actor_name       ?? null,
    p_reference_id:   input.reference_id     ?? null,
    p_reference_type: input.reference_type   ?? null,
    p_payload:        input.payload          ?? {},
  });

  if (error) {
    // nie blokujemy przepływu — oś czasu jest side-effectem
    console.warn('[timeline] create_timeline_event error:', error.message);
    return null;
  }

  return data as string | null;
}

// ─── Pobranie osi czasu projektu (z podziałem na widoczność) ────────────────

interface GetTimelineOptions {
  /** Jeśli false pokaż tylko client_shared (widok portalu klienta) */
  includeInternal?: boolean;
  limit?: number;
}

export async function getProjectTimeline(
  projectId: string,
  options: GetTimelineOptions = {},
): Promise<ProjectTimelineEvent[]> {
  const { includeInternal = true, limit = 100 } = options;

  if (!supabase) return []
  let query = supabase
    .from('project_timeline_events')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!includeInternal) {
    query = query.eq('visibility', 'client_shared');
  }

  const { data, error } = await query;

  if (error) {
    console.error('[timeline] getProjectTimeline error:', error.message);
    return [];
  }

  return (data ?? []) as ProjectTimelineEvent[];
}

// ─── Skróty dla typowych eventów ─────────────────────────────────────────────

interface SimpleTimelineParams {
  company_id: string;
  project_id: string;
  actor_id?: string;
  actor_name?: string;
}

export function buildTimelineEvent(
  params: SimpleTimelineParams,
  event_type: TimelineEventType,
  title: string,
  opts?: {
    description?: string;
    visibility?: TimelineVisibility;
    reference_id?: string;
    reference_type?: CreateTimelineEventInput['reference_type'];
    payload?: Record<string, unknown>;
  },
): CreateTimelineEventInput {
  return {
    company_id:     params.company_id,
    project_id:     params.project_id,
    event_type,
    visibility:     opts?.visibility ?? 'internal',
    title,
    description:    opts?.description,
    actor_type:     'operator',
    actor_id:       params.actor_id,
    actor_name:     params.actor_name,
    reference_id:   opts?.reference_id,
    reference_type: opts?.reference_type,
    payload:        opts?.payload ?? {},
  };
}

// ─── Demo — dane zastępcze gdy brak połączenia z Supabase ───────────────────

export function getDemoTimeline(projectId: string): ProjectTimelineEvent[] {
  const base = {
    company_id:   'demo-company',
    project_id:   projectId,
    actor_id:     null,
    description:  null,
    reference_id: null,
    reference_type: null,
    payload:      {},
  } as const;

  return [
    {
      ...base,
      id:          'demo-1',
      event_type:  'project_created',
      visibility:  'internal',
      actor_type:  'operator',
      actor_name:  'Jan Kowalski',
      title:       'Projekt został utworzony',
      created_at:  new Date(Date.now() - 7 * 86_400_000).toISOString(),
    },
    {
      ...base,
      id:          'demo-2',
      event_type:  'portal_activated',
      visibility:  'internal',
      actor_type:  'operator',
      actor_name:  'Jan Kowalski',
      title:       'Portal klienta został aktywowany',
      created_at:  new Date(Date.now() - 5 * 86_400_000).toISOString(),
    },
    {
      ...base,
      id:          'demo-3',
      event_type:  'cost_approval_sent',
      visibility:  'client_shared',
      actor_type:  'operator',
      actor_name:  'Jan Kowalski',
      title:       'Wysłano prośbę o akceptację kosztu: Sklep Budowlany ABC — 1 476,00 PLN',
      created_at:  new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
    {
      ...base,
      id:          'demo-4',
      event_type:  'cost_approved',
      visibility:  'client_shared',
      actor_type:  'client',
      actor_name:  'Klient',
      title:       'Klient zaakceptował koszt: Sklep Budowlany ABC — 1 476,00 PLN',
      created_at:  new Date(Date.now() - 1 * 86_400_000).toISOString(),
    },
  ] satisfies ProjectTimelineEvent[];
}
