import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "analytics_session_id";
const ENTRY_REF_KEY = "analytics_entry_referrer";
const UTM_KEY = "analytics_utm";

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
    source: p.get("utm_source") ?? p.get("gclid") ? (p.get("utm_source") ?? "google-ads") : "",
    medium: p.get("utm_medium") ?? "",
    campaign: p.get("utm_campaign") ?? "",
  };
  sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  return utm;
}

export function usePageTracking() {
  const location = useLocation();
  const startTime = useRef(Date.now());
  const lastPath = useRef<string | null>(null);
  const pageCount = useRef(0);
  const sentForPath = useRef<string | null>(null);

  useEffect(() => {
    // Skip bots
    if (/bot|crawl|spider|Lighthouse|PageSpeed|PTST|Googlebot/i.test(navigator.userAgent)) return;

    const sessionId = getSessionId();
    const entryReferrer = getEntryReferrer();
    const utm = getUtm();

    const send = (path: string, exit: boolean) => {
      if (!path) return;
      const timeOnPage = Math.max(0, Math.round((Date.now() - startTime.current) / 1000));
      void supabase.from("page_views").insert({
        session_id: sessionId,
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
      send(lastPath.current, false);
    }

    // Reset timer for the new page
    startTime.current = Date.now();
    lastPath.current = location.pathname;
    sentForPath.current = null;
    pageCount.current += 1;

    // pagehide + visibilitychange are far more reliable than beforeunload
    // (iOS Safari / Android Chrome never fire beforeunload on tab close).
    const flush = () => {
      if (sentForPath.current === location.pathname) return;
      sentForPath.current = location.pathname;
      send(location.pathname, true);
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [location.pathname]);
}
