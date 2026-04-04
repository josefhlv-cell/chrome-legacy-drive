import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StockTicker from "@/components/StockTicker";
import FeaturedVehicles from "@/components/FeaturedVehicles";
import ServicePreview from "@/components/ServicePreview";
import WhyUs from "@/components/WhyUs";
import MottoSection from "@/components/MottoSection";
import FamilyAdvantage from "@/components/FamilyAdvantage";
import ContactCTA from "@/components/ContactCTA";
import Footer from "@/components/Footer";
import IntroAnimation from "@/components/IntroAnimation";

const Index = () => (
  <div className="min-h-screen bg-background">
    <IntroAnimation />
    <Navbar />
    <HeroSection />
    <StockTicker />
    <FeaturedVehicles />
    <ServicePreview />
    <WhyUs />
    <MottoSection />
    <FamilyAdvantage />
    <ContactCTA />
    <Footer />
  </div>
);

export default Index;
