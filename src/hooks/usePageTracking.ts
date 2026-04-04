import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "analytics_session_id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function usePageTracking() {
  const location = useLocation();
  const startTime = useRef(Date.now());
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Skip bots
    if (/Lighthouse|PageSpeed|PTST|Googlebot/i.test(navigator.userAgent)) return;

    const sessionId = getSessionId();
    const now = Date.now();

    // Record time on previous page
    if (lastPath.current && lastPath.current !== location.pathname) {
      const timeOnPage = Math.round((now - startTime.current) / 1000);
      supabase.from("page_views").insert({
        session_id: sessionId,
        path: lastPath.current,
        referrer: document.referrer || "",
        time_on_page: timeOnPage,
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        is_bounce: false,
        exit_page: false,
      }).then(() => {});
    }

    // Reset timer for new page
    startTime.current = now;
    lastPath.current = location.pathname;

    // Record exit on unload
    const handleUnload = () => {
      const timeOnPage = Math.round((Date.now() - startTime.current) / 1000);
      // Use supabase client for reliable insert
      supabase.from("page_views").insert({
        session_id: sessionId,
        path: location.pathname,
        referrer: document.referrer || "",
        time_on_page: timeOnPage,
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        is_bounce: !lastPath.current || lastPath.current === location.pathname,
        exit_page: true,
      }).then(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [location.pathname]);
}
