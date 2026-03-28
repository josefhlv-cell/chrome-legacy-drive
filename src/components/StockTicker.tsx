import { motion } from "framer-motion";

const tickerItems = [
  "Před 3 hodinami: Chrysler Pacifica Hybrid rezervována (klient Brno)",
  "Nově na skladě: Chrysler 300C 5.7 HEMI (dovoz Florida)",
  "Na cestě: 2x Chrysler Grand Caravan z USA",
  "Prodáno: Dodge Challenger GT AWD (klient Praha)",
  "Nově na skladě: Chrysler Town & Country 3.6 LPG",
  "Rezervováno: Chrysler Pacifica Limited (klient Olomouc)",
];

const StockTicker = () => {
  const text = tickerItems.join("  •  ");
  const doubled = `${text}  •  ${text}`;

  return (
    <div className="bg-card/80 border-b border-border overflow-hidden py-2.5">
      <motion.div
        className="whitespace-nowrap flex"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <span className="text-xs tracking-wider text-muted-foreground font-medium">
          {doubled}
        </span>
      </motion.div>
    </div>
  );
};

export default StockTicker;
