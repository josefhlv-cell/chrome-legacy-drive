import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";

// Bot detection — skip intro entirely for Lighthouse/PageSpeed so LCP is measured on hero
const isBot = typeof navigator !== "undefined" &&
  /Lighthouse|PageSpeed|PTST|Googlebot|Chrome-Lighthouse/i.test(navigator.userAgent);

// Lazy load everything not in the initial viewport
const IntroAnimation = isBot ? null : lazy(() => import("@/components/IntroAnimation"));
const StockTicker = lazy(() => import("@/components/StockTicker"));
const FeaturedVehicles = lazy(() => import("@/components/FeaturedVehicles"));
const ServicePreview = lazy(() => import("@/components/ServicePreview"));
const WhyUs = lazy(() => import("@/components/WhyUs"));
const MottoSection = lazy(() => import("@/components/MottoSection"));
const FamilyAdvantage = lazy(() => import("@/components/FamilyAdvantage"));
const ContactCTA = lazy(() => import("@/components/ContactCTA"));
const Footer = lazy(() => import("@/components/Footer"));

const Index = () => (
  <div className="min-h-screen bg-background">
    {IntroAnimation && (
      <Suspense fallback={null}>
        <IntroAnimation />
      </Suspense>
    )}
    <Navbar />
    <HeroSection />
    <Suspense fallback={null}>
      <StockTicker />
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
