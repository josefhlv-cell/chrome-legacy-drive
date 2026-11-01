/**
 * Vstupní bod Smart Capture: při každém otevření vynutí vypnuté pozadí.
 * Uživatel ho může zapnout ručně pro danou session.
 */
try {
  localStorage.setItem("capture-show-background", "0");
} catch {
  // Private mode / blocked storage
}

export { default } from "./SmartCapture";
