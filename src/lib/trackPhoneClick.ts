import { supabase } from "@/integrations/supabase/client";
import { getVisitorIdentity, isBotUserAgent } from "@/lib/visitorId";

/**
 * Měření prokliků na telefonní číslo.
 *
 * Ukládá session_id ve STEJNÉM formátu jako page_views (klíč "analytics_session_id"
 * v sessionStorage), aby se prokliky daly párovat s návštěvností, a navíc
 * visitor_id + is_new_visitor pro rozpad na nové a vracející se zákazníky.
 */

const SESSION_KEY = "analytics_session_id";
/** Ochrana proti dvojímu zápisu při dvojkliku / re-renderu (ms). */
const DEDUPE_MS = 3000;
const recent = new Map<string, number>();

function getSessionId(): string {
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
}

export function trackPhoneClick(phone: string, source = ""): void {
  if (typeof window === "undefined") return;
  if (isBotUserAgent()) return;

  const key = `${phone}|${source}`;
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  recent.set(key, now);

  const { visitorId, isNew } = getVisitorIdentity();

  void supabase.from("phone_clicks").insert({
    session_id: getSessionId(),
    visitor_id: visitorId,
    is_new_visitor: isNew,
    phone: phone.replace(/\s+/g, "").slice(0, 32),
    path: window.location.pathname.slice(0, 256),
    source: source.slice(0, 64),
  });
}
