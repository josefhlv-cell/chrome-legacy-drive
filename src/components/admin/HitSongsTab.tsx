// HitSongsTab — admin sekce „To bude hit".
// Zobrazí pondělní písničky, umožní vygenerovat novou ručně.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Music, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMara } from "./MaraAssistant";

interface Song {
  id: string;
  week_start: string;
  title: string;
  lyrics: string;
  is_special: boolean;
  created_at: string;
}

const HitSongsTab = () => {
  const { toast } = useToast();
  const { say } = useMara();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: songs, isLoading } = useQuery<Song[]>({
    queryKey: ["weekly-hit-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_hit_songs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  const generate = async (special = false) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-hit", {
        body: { special },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Nová písnička je tu", description: data?.song?.title });
      say(`Hotovo! Nový hit: „${data?.song?.title}". Mrkni dolů.`, { title: "To bude hit" });
      qc.invalidateQueries({ queryKey: ["weekly-hit-songs"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Neznámá chyba";
      toast({ title: "Generování selhalo", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weekly_hit_songs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-hit-songs"] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground uppercase tracking-wider">To bude hit</h2>
          <p className="text-xs text-muted-foreground">
            Každé pondělí Mára napíše text popové písničky ve stylu Chinaski s ambicí stát se hitem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => generate(false)}
          disabled={generating}
          className="chrome-button inline-flex items-center gap-2 text-sm"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Vygenerovat novou
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Načítám…
        </div>
      ) : !songs?.length ? (
        <div className="deep-card p-8 text-center text-sm text-muted-foreground">
          Žádné písničky zatím nejsou. Klikni na „Vygenerovat novou".
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {songs.map((s) => (
            <motion.article
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="deep-card p-5"
            >
              <header className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-primary font-semibold">
                    <Music className="w-3 h-3" />
                    {s.is_special ? "Mimořádný" : new Date(s.created_at).toLocaleDateString("cs-CZ")}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mt-1">{s.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { if (confirm("Smazat?")) remove.mutate(s.id); }}
                  className="text-muted-foreground hover:text-destructive transition"
                  aria-label="Smazat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </header>
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
{s.lyrics}
              </pre>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
};

export default HitSongsTab;
