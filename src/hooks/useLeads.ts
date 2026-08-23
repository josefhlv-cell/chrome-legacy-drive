import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export const useCreateLead = () => {
  return useMutation({
    mutationFn: async (lead: TablesInsert<"leads">) => {
      // Bez `.select()` — anonymní návštěvník smí poptávku vložit, ale ne čtení.
      // Vracení vloženého řádku by RLS zamítla (42501) a formulář by selhal.
      const { error } = await supabase.from("leads").insert(lead);
      if (error) throw error;


      // Fire-and-forget email notification to obchod@chrysler.cz
      // Failure here must NOT block the user — the lead is already saved.
      supabase.functions
        .invoke("send-lead-notification", {
          body: {
            type: lead.type,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            vehicle_model: lead.vehicle_model,
            message: lead.message,
            metadata: lead.metadata,
          },
        })
        .catch((err) => console.warn("Lead notification failed:", err));

      return lead;
    },
  });
};
