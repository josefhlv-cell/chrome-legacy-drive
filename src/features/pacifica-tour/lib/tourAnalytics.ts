/**
 * Interní měření virtuální prohlídky Chrysler Pacifica.
 *
 * Zapisuje do tabulky `tour_events`. Roboti (Lighthouse, PageSpeed, scrapery)
 * se nikdy nezapočítávají — stejné pravidlo jako u page_views a phone_clicks.
 */
import { supabase } from "@/integrations/supabase/client";
import { getVisitorIdentity, isBotUserAgent } from "@/lib/visitorId";

const SESSION_KEY = "analytics_session_id";

export type TourEventName =
  | "tour_open"
  | "tour_start"
  | "hotspot_view"
  | "color_change"
  | "guided_start"
  | "guided_complete"
  | "snapshot"
  | "interior_unlock"
  | "interior_step"
  | "interior_complete"
  | "tour_exit"
  | "lead_open"
  | "lead_submit"
  | "ar_open"
  | "ar_launch"
  | "ar_exit"
  | "ar_unsupported";

type Payload = {
  step?: string | null;
  color?: string | null;
  meta?: Record<string, unknown> | null;
};

const getSessionId = (): string => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
};

/** Zabrání dvojímu zápisu stejné události při re-renderu (ms). */
const DEDUPE_MS = 1200;
const recent = new Map<string, number>();

export const trackTourEvent = (
  event: TourEventName,
  payload: Payload = {},
): void => {
  if (typeof window === "undefined") return;
  if (isBotUserAgent()) return;

  const key = `${event}|${payload.step ?? ""}|${payload.color ?? ""}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return;
  recent.set(key, now);

  const { visitorId, isNew } = getVisitorIdentity();

  void supabase
    .from("tour_events")
    .insert({
      session_id: getSessionId(),
      visitor_id: visitorId,
      is_new_visitor: isNew,
      event,
      step: payload.step ?? null,
      color: payload.color ?? null,
      meta: (payload.meta ?? null) as never,
      path: window.location.pathname.slice(0, 256),
    })
    .then(({ error }) => {
      if (error) console.warn("tour_events insert failed:", error.message);
    });
};
