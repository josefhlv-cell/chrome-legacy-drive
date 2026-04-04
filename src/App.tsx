import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { usePageTracking } from "@/hooks/usePageTracking";
import Index from "./pages/Index.tsx";
import ScrollToTop from "./components/ScrollToTop.tsx";

// Lazy load non-critical routes
const Vehicles = lazy(() => import("./pages/Vehicles.tsx"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail.tsx"));
const ImportPage = lazy(() => import("./pages/Import.tsx"));
const TradeIn = lazy(() => import("./pages/TradeIn.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const Service = lazy(() => import("./pages/Service.tsx"));
const SpareParts = lazy(() => import("./pages/SpareParts.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AppBanner = lazy(() => import("./components/AppBanner.tsx"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Tracker component inside BrowserRouter
const PageTracker = () => {
  usePageTracking();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <PageTracker />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/vozidla" element={<Vehicles />} />
              <Route path="/vozidla/:id" element={<VehicleDetail />} />
              <Route path="/dovoz" element={<ImportPage />} />
              <Route path="/vykup" element={<TradeIn />} />
              <Route path="/servis" element={<Service />} />
              <Route path="/nahradni-dily" element={<SpareParts />} />
              <Route path="/o-nas" element={<About />} />
              <Route path="/kontakt" element={<Contact />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Suspense fallback={null}>
            <AppBanner />
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
