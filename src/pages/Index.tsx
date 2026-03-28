import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StockTicker from "@/components/StockTicker";
import FeaturedVehicles from "@/components/FeaturedVehicles";
import MottoSection from "@/components/MottoSection";
import FamilyAdvantage from "@/components/FamilyAdvantage";
import AppShowcase from "@/components/AppShowcase";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <StockTicker />
    <FeaturedVehicles />
    <AppShowcase />
    <MottoSection />
    <FamilyAdvantage />
    <Footer />
  </div>
);

export default Index;
