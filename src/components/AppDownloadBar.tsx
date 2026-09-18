import { Smartphone } from "lucide-react";

const ANDROID_APK =
  "https://chryslerpardubice.site/__l5e/assets-v1/77ce6d1c-f5bd-416f-9bb9-788e36b96ff6/chdp-garaz-android.apk";
const IOS_URL = "https://apps.apple.com/app/id6807151165";

/**
 * Trvalý úzký pruh ve spodní části každé stránky s odkazem na stažení aplikace.
 * Bez animací (výkon), bez zavírání — je trvalý.
 */
const AppDownloadBar = () => (
  <div className="fixed bottom-0 left-0 right-0 z-[90] border-t border-primary/30 bg-background/95 backdrop-blur-md">
    <div className="container mx-auto px-3 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Smartphone className="w-4 h-4 text-primary shrink-0" />
        <p className="font-montserrat text-[11px] sm:text-sm text-foreground truncate">
          <span className="font-semibold">CHDP Garáž</span>
          <span className="hidden sm:inline text-muted-foreground">
            {" "}— celý servis v kapse
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={ANDROID_APK}
          download
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[11px] sm:text-xs font-semibold font-montserrat"
        >
          Android
        </a>
        <a
          href={IOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors text-[11px] sm:text-xs font-semibold font-montserrat"
        >
          iOS
        </a>
      </div>
    </div>
  </div>
);

export default AppDownloadBar;
