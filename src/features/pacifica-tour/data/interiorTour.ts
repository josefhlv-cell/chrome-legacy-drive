const Card = ({
  card,
  expanded,
  onToggleExpanded,
  onClose,
}: {
  card: TourCard;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) => {
  const videos = getCardVideos(card);
  const collapsible = isCollapsibleCard(card);

  /*
   * ZABALENÁ KARTA:
   * Nikdy nepřekrývá celou fotografii.
   * Zůstává jako běžná spodní karta.
   *
   * Video se zobrazí až po ručním rozbalení.
   */
  if (collapsible && !expanded) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 max-h-[34vh] overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111925]/98 p-5 pb-28 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(560px,calc(100vw-48px))] sm:max-h-[34vh] sm:rounded-[28px] sm:pb-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít detail"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70"
        >
          ×
        </button>

        <div className="pr-12">
          <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6b96e8]">
            {card.eyebrow}
          </div>

          <h2 className="mt-2 font-serif text-2xl font-semibold text-white">
            {card.title}
          </h2>

          <p className="mt-3 line-clamp-3 text-[16px] leading-7 text-white/65">
            {card.text}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-5 w-full rounded-full bg-[#3f7bd7] px-6 py-4 text-sm font-semibold text-white shadow-lg"
        >
          Rozbalit detail ↓
        </button>
      </div>
    );
  }

  /*
   * ROZBALENÁ KARTA:
   * Teprve zde se zobrazí video.
   */
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 max-h-[82vh] overflow-y-auto overscroll-contain rounded-t-[28px] border border-white/10 bg-[#111925]/98 p-5 pb-32 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(560px,calc(100vw-48px))] sm:max-h-[82vh] sm:rounded-[28px] sm:pb-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Zavřít detail"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70"
      >
        ×
      </button>

      <div className="pr-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6b96e8]">
          {card.eyebrow}
        </div>

        <h2 className="mt-2 font-serif text-2xl font-semibold text-white">
          {card.title}
        </h2>

        <p className="mt-3 text-[16px] leading-7 text-white/65">
          {card.text}
        </p>
      </div>

      {/* VIDEO SE ZOBRAZÍ AŽ PO ROZBALENÍ */}
      {videos.length > 0 && (
        <VideoCardMedia videos={videos} />
      )}

      {card.bullets && card.bullets.length > 0 && (
        <ul className="mt-5 space-y-2 text-[15px] leading-6 text-white/70">
          {card.bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4d80d8]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {card.sections?.map((section) => (
        <section
          key={section.title}
          className="mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
        >
          <div className="text-[11px] uppercase tracking-[0.25em] text-[#6b96e8]">
            {section.title}
          </div>

          <div className="mt-3 space-y-3 text-[15px] leading-6 text-white/70">
            {section.items.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      ))}

      {card.note && (
        <p className="mt-5 border-t border-white/8 pt-4 text-xs leading-5 text-white/45">
          {card.note}
        </p>
      )}

      <button
        type="button"
        onClick={onToggleExpanded}
        className="mt-5 w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-semibold text-white/70"
      >
        Sbalit detail ↑
      </button>
    </div>
  );
};
