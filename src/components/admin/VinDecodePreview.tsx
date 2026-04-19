import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export type DecodedVehicle = {
  name?: string;
  year?: number;
  fuel?: string;
  engine?: string;
  transmission?: string;
  power?: string;
  body?: string;
  doors?: string;
  drive?: string;
  typicalEquipment?: string;
};

const FIELD_LABELS: Record<keyof DecodedVehicle, string> = {
  name: "Název",
  year: "Rok",
  fuel: "Palivo",
  engine: "Motor",
  transmission: "Převodovka",
  power: "Výkon",
  body: "Karoserie",
  doors: "Dveře",
  drive: "Pohon",
  typicalEquipment: "Typická výbava (jen pro AI popis)",
};

// Pole, která se mapují na sloupce ve vehicles
const APPLICABLE_FIELDS: (keyof DecodedVehicle)[] = [
  "name", "year", "fuel", "engine", "transmission", "power",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decoded: DecodedVehicle | null;
  currentValues: Partial<Record<keyof DecodedVehicle, any>>;
  onApply: (selected: Partial<DecodedVehicle>) => void;
}

const VinDecodePreview = ({ open, onOpenChange, decoded, currentValues, onApply }: Props) => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!decoded) return;
    // Default: vyber pouze prázdná pole
    const init: Record<string, boolean> = {};
    APPLICABLE_FIELDS.forEach((k) => {
      if (decoded[k] !== undefined && decoded[k] !== "" && decoded[k] !== null) {
        const cur = currentValues[k];
        const isEmpty = cur === undefined || cur === "" || cur === null || cur === 0;
        init[k] = isEmpty;
      }
    });
    if (decoded.typicalEquipment) init.typicalEquipment = true;
    setSelected(init);
  }, [decoded, open]);

  if (!decoded) return null;

  const toggle = (key: string) => setSelected((s) => ({ ...s, [key]: !s[key] }));

  const handleApply = () => {
    const result: Partial<DecodedVehicle> = {};
    (Object.keys(selected) as (keyof DecodedVehicle)[]).forEach((k) => {
      if (selected[k] && decoded[k] !== undefined) {
        (result as any)[k] = decoded[k];
      }
    });
    onApply(result);
    onOpenChange(false);
  };

  const allKeys: (keyof DecodedVehicle)[] = [
    ...APPLICABLE_FIELDS.filter((k) => decoded[k] !== undefined && decoded[k] !== ""),
    ...(decoded.typicalEquipment ? (["typicalEquipment"] as (keyof DecodedVehicle)[]) : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Náhled detekovaných dat z VIN</DialogTitle>
          <DialogDescription>
            Vyberte pole, která se mají vyplnit / přepsat. Prázdná pole jsou předvybrána.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {allKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">VIN nevrátil žádná použitelná data.</p>
          )}
          {allKeys.map((key) => {
            const newVal = decoded[key];
            const curVal = currentValues[key];
            const isOverwrite = curVal !== undefined && curVal !== "" && curVal !== null && curVal !== 0;
            return (
              <div key={key} className="flex items-start gap-3 p-3 rounded-md border border-border bg-card/50">
                <Checkbox
                  id={`vin-${key}`}
                  checked={!!selected[key]}
                  onCheckedChange={() => toggle(key)}
                  className="mt-1"
                />
                <label htmlFor={`vin-${key}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      {FIELD_LABELS[key]}
                    </span>
                    {isOverwrite && (
                      <span className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">
                        přepíše
                      </span>
                    )}
                  </div>
                  {isOverwrite && (
                    <p className="text-xs text-muted-foreground line-through mb-1">{String(curVal)}</p>
                  )}
                  <p className="text-sm text-foreground break-words">{String(newVal)}</p>
                </label>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={handleApply} disabled={!Object.values(selected).some(Boolean)}>
            Vyplnit vybraná pole
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VinDecodePreview;
