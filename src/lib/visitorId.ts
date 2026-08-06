/**
 * Dlouhodobá identita návštěvníka.
 *
 * session_id (sessionStorage) zmizí se zavřením tabu – nešlo tedy poznat,
 * jestli je návštěva první, nebo se člověk vrací. visitor_id žije v localStorage,
 * takže přežije zavření prohlížeče a umožní rozlišit nové a vracející se zákazníky.
 */

const VISITOR_KEY = "analytics_visitor_id";
const FIRST_SEEN_KEY = "analytics_first_seen";

export interface VisitorIdentity {
  visitorId: string;
  /** true jen tehdy, když bylo visitor_id vytvořeno právě teď (skutečně nový člověk). */
  isNew: boolean;
  firstSeen: string;
}

let cached: VisitorIdentity | null = null;

export function getVisitorIdentity(): VisitorIdentity {
  if (cached) return cached;

  let visitorId = "";
  let firstSeen = "";
  let isNew = false;

  try {
    visitorId = localStorage.getItem(VISITOR_KEY) || "";
    firstSeen = localStorage.getItem(FIRST_SEEN_KEY) || "";
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      firstSeen = new Date().toISOString();
      localStorage.setItem(VISITOR_KEY, visitorId);
      localStorage.setItem(FIRST_SEEN_KEY, firstSeen);
      isNew = true;
    } else if (!firstSeen) {
      firstSeen = new Date().toISOString();
      localStorage.setItem(FIRST_SEEN_KEY, firstSeen);
    }
  } catch {
    // privátní režim / zakázané localStorage – fallback jen pro tento běh
    visitorId = visitorId || crypto.randomUUID();
    firstSeen = firstSeen || new Date().toISOString();
    isNew = true;
  }

  cached = { visitorId, isNew, firstSeen };
  return cached;
}

export function getVisitorId(): string {
  return getVisitorIdentity().visitorId;
}

/** Bot / headless filtr – používá se u všech trackovacích zápisů. */
export function isBotUserAgent(ua: string = navigator.userAgent): boolean {
  if (/bot|crawl|spider|slurp|scrape|fetch|curl|wget|python|java|axios|node-fetch|okhttp|libwww|headless|phantom|selenium|puppeteer|playwright|lighthouse|pagespeed|ptst|gtmetrix|preview|monitor|uptime|semrush|ahrefs|mj12|dotbot|petal|yandex|baidu|bingpreview|facebookexternalhit|whatsapp|telegram|discord|embedly/i.test(ua)) {
    return true;
  }
  // navigator.webdriver = automatizovaný prohlížeč (Playwright/Selenium)
  if (typeof navigator !== "undefined" && (navigator as any).webdriver) return true;
  return false;
}
