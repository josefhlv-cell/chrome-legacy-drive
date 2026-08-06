import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorIdentity, isBotUserAgent } from "@/lib/visitorId";

const SESSION_KEY = "analytics_session_id";
const ENTRY_REF_KEY = "analytics_entry_referrer";
const UTM_KEY = "analytics_utm";

/** Horní strop doby na stránce (30 min). Karta nechaná otevřená přes noc dřív
 *  zapsala desítky tisíc sekund a rozbila průměrnou dobu návštěvy. */
const MAX_TIME_ON_PAGE = 30 * 60;

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** Original external referrer of the session (never our own domain). */
function getEntryReferrer(): string {
  const stored = sessionStorage.getItem(ENTRY_REF_KEY);
  if (stored !== null) return stored;
  let ref = "";
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== window.location.hostname) ref = document.referrer;
    }
  } catch { /* ignore */ }
  sessionStorage.setItem(ENTRY_REF_KEY, ref);
  return ref;
}

interface Utm { source: string; medium: string; campaign: string }

function getUtm(): Utm {
  const stored = sessionStorage.getItem(UTM_KEY);
  if (stored) {
    try { return JSON.parse(stored) as Utm; } catch { /* ignore */ }
  }
  const p = new URLSearchParams(window.location.search);
  const utm: Utm = {
    source: p.get("utm_source") || (p.get("gclid") ? "google-ads" : ""),
    medium: p.get("utm_medium") ?? "",
    campaign: p.get("utm_campaign") ?? "",
  };
  sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  return utm;
}

/**
 * OPRAVY (audit):
 * 1) Duplicitní zápisy: dřív mohl `pagehide` i `visibilitychange` proběhnout
 *    pro stejnou stránku, a navíc StrictMode/rychlá navigace spouštěly efekt
 *    dvakrát. Nově drží modul globální set `writtenKeys` (session+path+start),
 *    takže každý pobyt na stránce se zapíše právě jednou.
 * 2) time_on_page je zastropovaný na 30 minut (viz MAX_TIME_ON_PAGE).
 * 3) Bot filtr je centralizovaný v isBotUserAgent() a pokrývá i headless
 *    prohlížeče, scrapery a náhledové roboty sociálních sítí.
 */
const writtenKeys = new Set<string>();

export function usePageTracking() {
  const location = useLocation();
  const startTime = useRef(Date.now());
  const lastPath = useRef<string | null>(null);
  const pageCount = useRef(0);

  useEffect(() => {
    if (isBotUserAgent()) return;

    const sessionId = getSessionId();
    const entryReferrer = getEntryReferrer();
    const utm = getUtm();
    const { visitorId, isNew } = getVisitorIdentity();

    const send = (path: string, startedAt: number, exit: boolean) => {
      if (!path) return;
      const key = `${sessionId}|${path}|${startedAt}`;
      if (writtenKeys.has(key)) return;
      writtenKeys.add(key);

      const raw = Math.round((Date.now() - startedAt) / 1000);
      const timeOnPage = Math.min(MAX_TIME_ON_PAGE, Math.max(0, raw));

      void supabase.from("page_views").insert({
        session_id: sessionId,
        visitor_id: visitorId,
        is_new_visitor: isNew,
        path,
        referrer: entryReferrer,
        entry_referrer: entryReferrer,
        utm_source: utm.source || null,
        utm_medium: utm.medium || null,
        utm_campaign: utm.campaign || null,
        time_on_page: timeOnPage,
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        is_bounce: exit && pageCount.current <= 1,
        exit_page: exit,
      });
    };

    // Record time spent on the previous page when navigating within the SPA
    if (lastPath.current && lastPath.current !== location.pathname) {
      send(lastPath.current, startTime.current, false);
    }

    // Reset timer for the new page
    const startedAt = Date.now();
    startTime.current = startedAt;
    lastPath.current = location.pathname;
    pageCount.current += 1;

    // pagehide + visibilitychange are far more reliable than beforeunload
    // (iOS Safari / Android Chrome never fire beforeunload on tab close).
    const flush = () => send(location.pathname, startedAt, true);
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [location.pathname]);
}
