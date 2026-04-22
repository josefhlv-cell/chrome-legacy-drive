import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import surpriseImg from "@/assets/admin-surprise.jpeg";

const TARGET_EMAILS = ["admin@chrysler-pardubice.cz", "josefhlv@gmail.com"];
const STORAGE_PREFIX = "admin-surprise-shown-v2:";
const DELAY_MS = 60_000;
const LOCK_MS = 60_000;

const matchesTarget = (email: string | null | undefined) => {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return TARGET_EMAILS.some((t) => normalized.includes(t.toLowerCase()));
};

const AdminSurprise = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    if (!user?.email || !matchesTarget(user.email)) return;
    const key = `${STORAGE_PREFIX}${user.email.toLowerCase()}`;
    if (localStorage.getItem(key)) return;

    // Mark immediately to prevent re-trigger across reloads
    localStorage.setItem(key, new Date().toISOString());

    const showTimer = window.setTimeout(() => {
      setOpen(true);
      setLocked(true);
      const unlockTimer = window.setTimeout(() => setLocked(false), LOCK_MS);
      return () => window.clearTimeout(unlockTimer);
    }, DELAY_MS);

    return () => window.clearTimeout(showTimer);
  }, [user?.email]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <img
        src={surpriseImg}
        alt=""
        className="max-w-full max-h-full object-contain"
      />
      {!locked && (
        <button
          onClick={() => setOpen(false)}
          className="absolute top-6 right-6 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold font-montserrat hover:bg-primary/90 transition-colors"
        >
          Zavřít
        </button>
      )}
    </div>
  );
};

export default AdminSurprise;
