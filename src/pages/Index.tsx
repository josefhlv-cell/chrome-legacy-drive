import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturedVehicles from "@/components/FeaturedVehicles";
import MottoSection from "@/components/MottoSection";
import FamilyAdvantage from "@/components/FamilyAdvantage";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <FeaturedVehicles />
    <MottoSection />
    <FamilyAdvantage />
    <Footer />
  </div>
);

export default Index;
