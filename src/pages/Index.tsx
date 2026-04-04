import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StockTicker from "@/components/StockTicker";
import IntroAnimation from "@/components/IntroAnimation";

// Lazy load below-the-fold sections
const FeaturedVehicles = lazy(() => import("@/components/FeaturedVehicles"));
const ServicePreview = lazy(() => import("@/components/ServicePreview"));
const WhyUs = lazy(() => import("@/components/WhyUs"));
const MottoSection = lazy(() => import("@/components/MottoSection"));
const FamilyAdvantage = lazy(() => import("@/components/FamilyAdvantage"));
const ContactCTA = lazy(() => import("@/components/ContactCTA"));
const Footer = lazy(() => import("@/components/Footer"));

const Index = () => (
  <div className="min-h-screen bg-background">
    <IntroAnimation />
    <Navbar />
    <HeroSection />
    <StockTicker />
    <Suspense fallback={null}>
      <FeaturedVehicles />
      <ServicePreview />
      <WhyUs />
      <MottoSection />
      <FamilyAdvantage />
      <ContactCTA />
      <Footer />
    </Suspense>
  </div>
);

export default Index;
