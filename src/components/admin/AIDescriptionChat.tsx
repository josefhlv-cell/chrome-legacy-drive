import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Loader2, Check, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ChatTurn = { role: "user" | "assistant"; content: string };

interface AIDescriptionChatProps {
  open: boolean;
  onClose: () => void;
  vehicleData: Record<string, any>;
  initialDescription?: string;
  onApply: (description: string) => void;
}

const QUICK_PROMPTS = [
  "Zkrať na cca polovinu",
  "Zdůrazni rodinné využití",
  "Více formálnější tón",
  "Více emotivní, prodejnější",
  "Přidej důraz na úsporu (LPG/spotřeba)",
];

const AIDescriptionChat = ({ open, onClose, vehicleData, initialDescription = "", onApply }: AIDescriptionChatProps) => {
  const { toast } = useToast();
  const [currentDescription, setCurrentDescription] = useState(initialDescription);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setCurrentDescription(initialDescription);
      setHistory(initialDescription ? [{ role: "assistant", content: initialDescription }] : []);
      setFeedback("");
    }
  }, [open, initialDescription]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, loading]);

  if (!open) return null;

  const callAI = async (userFeedback: string | null) => {
    setLoading(true);
    try {
      const body: any = { vehicle: vehicleData };
      if (userFeedback) {
        body.currentDescription = currentDescription;
        body.feedback = userFeedback;
      }
      const { data, error } = await supabase.functions.invoke("generate-vehicle-description", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const description = (data?.description || "").trim();
      if (!description) throw new Error("Prázdná odpověď");
      setCurrentDescription(description);
      setHistory((prev) => [...prev, { role: "assistant", content: description }]);
    } catch (e: any) {
      toast({ title: "AI chyba", description: e?.message || "Neznámá chyba", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = feedback.trim();
    if (!text || loading) return;
    setHistory((prev) => [...prev, { role: "user", content: text }]);
    setFeedback("");
    await callAI(text);
  };

  const handleInitialGenerate = () => callAI(null);

  const handleQuickPrompt = (prompt: string) => {
    if (loading) return;
    setHistory((prev) => [...prev, { role: "user", content: prompt }]);
    callAI(prompt);
  };

  const handleApply = () => {
    if (!currentDescription) return;
    onApply(currentDescription);
    toast({ title: "Popis vložen do formuláře" });
    onClose();
  };

  const handleReset = () => {
    setCurrentDescription("");
    setHistory([]);
    setFeedback("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-display text-lg">AI generátor popisu</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {history.length === 0 && !loading && (
            <div className="text-center py-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                Vygeneruj první verzi popisu z vyplněných údajů vozu.
              </p>
              <button
                onClick={handleInitialGenerate}
                className="chrome-button inline-flex items-center gap-2 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Vygenerovat popis
              </button>
            </div>
          )}

          {history.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {turn.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        {history.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                disabled={loading}
                onClick={() => handleQuickPrompt(p)}
                className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input + actions */}
        <div className="border-t border-border p-3 space-y-2">
          {history.length > 0 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={loading}
                placeholder="Napiš úpravu (např. 'zkrať', 'přidej info o bezpečnosti')..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleSend}
                disabled={loading || !feedback.trim()}
                className="chrome-button !px-3"
                title="Odeslat instrukci"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentDescription && (
            <div className="flex gap-2 justify-between">
              <button
                onClick={handleReset}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Začít znovu
              </button>
              <button
                onClick={handleApply}
                disabled={loading}
                className="chrome-button inline-flex items-center gap-1.5 text-sm bg-primary text-primary-foreground"
              >
                <Check className="w-4 h-4" />
                Použít tento popis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIDescriptionChat;
