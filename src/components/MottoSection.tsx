import { motion } from "framer-motion";

const MottoSection = () => (
  <section className="py-20 bg-background relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-card/50 to-transparent" />
    <div className="container mx-auto px-4 relative z-10 text-center">
      <motion.blockquote
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto"
      >
        <p className="text-2xl md:text-4xl font-bold text-foreground leading-snug tracking-wide">
          „U nás prodejem cesta teprve začíná.
          <br />
          <span className="text-primary">Vítejte v rodině Chrysler.</span>"
        </p>
        <p className="mt-8 text-muted-foreground text-sm leading-relaxed max-w-2xl mx-auto">
          Koupě vozu u nás není jen transakce. Je to moment, kdy se stáváte součástí komunity,
          která si cení výjimečného komfortu a individuálního přístupu. Našim zákazníkům neposkytujeme
          pouze klíče od vozu, ale příslib doživotní péče, nadstandardního servisu a zázemí rodinné firmy,
          pro kterou je vaše spokojenost osobní vizitkou.
        </p>
      </motion.blockquote>
    </div>
  </section>
);

export default MottoSection;
