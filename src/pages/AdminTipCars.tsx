import { Link } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import TipCarsTab from "@/components/admin/TipCarsTab";

export default function AdminTipCarsPage() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Načítání…</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 container mx-auto px-4 text-center">
          <p className="text-destructive text-lg font-semibold">Nemáte oprávnění pro tuto stránku.</p>
          <Link to="/admin" className="outline-button mt-4 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Zpět do administrace
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Send className="w-6 h-6 text-emerald-400" />
              <div>
                <h1 className="section-heading text-2xl">TipCars import</h1>
                <p className="text-xs text-muted-foreground">
                  Samostatné centrum pro automatický export inzerátů na TipCars.
                </p>
              </div>
            </div>
            <Link to="/admin" className="outline-button inline-flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Zpět do administrace
            </Link>
          </div>

          <TipCarsTab />
        </div>
      </div>
      <Footer />
    </div>
  );
}
