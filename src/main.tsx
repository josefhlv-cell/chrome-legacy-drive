import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Hydrate immediately — no StrictMode wrapper for production perf
createRoot(document.getElementById("root")!).render(<App />);
