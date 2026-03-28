import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Vehicles from "./pages/Vehicles.tsx";
import VehicleDetail from "./pages/VehicleDetail.tsx";
import ImportPage from "./pages/Import.tsx";
import TradeIn from "./pages/TradeIn.tsx";
import About from "./pages/About.tsx";
import Contact from "./pages/Contact.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/vozidla" element={<Vehicles />} />
          <Route path="/vozidla/:id" element={<VehicleDetail />} />
          <Route path="/dovoz" element={<ImportPage />} />
          <Route path="/vykup" element={<TradeIn />} />
          <Route path="/o-nas" element={<About />} />
          <Route path="/kontakt" element={<Contact />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
