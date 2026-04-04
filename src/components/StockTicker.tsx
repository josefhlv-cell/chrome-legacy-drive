import { motion } from "framer-motion";
import { useTickerItems } from "@/hooks/useAdminContent";

const fallbackItems = [
  "Nově na skladě: Chrysler Pacifica Hybrid (dovoz Florida)",
  "Na cestě: 2x Chrysler Grand Caravan z USA",
  "Prodáno: Dodge Challenger GT AWD (klient Praha)",
];

const StockTicker = () => {
  const { data: dbItems } = useTickerItems();

  const activeItems = dbItems?.filter((i) => i.is_active).map((i) => i.text);
  const tickerItems = activeItems && activeItems.length > 0 ? activeItems : fallbackItems;

  const text = tickerItems.join("  •  ");
  const doubled = `${text}  •  ${text}`;

  return (
    <div className="overflow-hidden py-3" style={{
      background: 'linear-gradient(90deg, hsl(218 50% 8%), hsl(218 45% 11%), hsl(218 50% 8%))',
      borderBottom: '1px solid hsla(210, 15%, 50%, 0.1)',
    }}>
      <motion.div
        className="whitespace-nowrap flex"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <span className="text-xs tracking-widest text-muted-foreground font-medium font-montserrat uppercase">
          {doubled}
        </span>
      </motion.div>
    </div>
  );
};

export default StockTicker;
