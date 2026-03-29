import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Vehicles from "./pages/Vehicles.tsx";
import VehicleDetail from "./pages/VehicleDetail.tsx";
import ImportPage from "./pages/Import.tsx";
import TradeIn from "./pages/TradeIn.tsx";
import About from "./pages/About.tsx";
import Contact from "./pages/Contact.tsx";
import Service from "./pages/Service.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppBanner from "./components/AppBanner.tsx";
import ScrollToTop from "./components/ScrollToTop.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/vozidla" element={<Vehicles />} />
            <Route path="/vozidla/:id" element={<VehicleDetail />} />
            <Route path="/dovoz" element={<ImportPage />} />
            <Route path="/vykup" element={<TradeIn />} />
            <Route path="/servis" element={<Service />} />
            <Route path="/o-nas" element={<About />} />
            <Route path="/kontakt" element={<Contact />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AppBanner />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
