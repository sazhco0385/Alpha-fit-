import { useState } from "react";
import { ChevronDown } from "lucide-react";

/** Collapsible section wrapper for the Dashboard. Header stays visible; body toggles.
 *  Optional `storageKey` persists open/closed state to localStorage across sessions. */
export default function CollapsibleSection({
  title,
  icon: Icon,
  hint,
  defaultOpen = false,
  storageKey,
  children,
  testid,
  headerRight = null,
}) {
  const [open, setOpen] = useState(() => {
    if (storageKey) {
      try {
        const raw = localStorage.getItem(`af_cs_${storageKey}`);
        if (raw === "1") return true;
        if (raw === "0") return false;
      } catch (_e) { /* localStorage unavailable */ }
    }
    return defaultOpen;
  });

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (storageKey) {
        try { localStorage.setItem(`af_cs_${storageKey}`, next ? "1" : "0"); } catch (_e) { /* ignore */ }
      }
      return next;
    });
  };
  return (
    <section className="mb-4 sm:mb-5" data-testid={testid}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 py-2 px-1 group"
        data-testid={`${testid}-toggle`}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={16} className="text-[#00BFFF] flex-shrink-0" />}
          <h2 className="font-teko text-xl sm:text-2xl tracking-wider chrome-text uppercase leading-none whitespace-nowrap">
            {title}
          </h2>
          {hint && !open && (
            <span className="text-[10px] sm:text-[11px] text-gray-500 font-chakra truncate">· {hint}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerRight}
          <ChevronDown
            size={18}
            className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-[#00BFFF]" : ""}`}
          />
        </div>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-[6000px] opacity-100 mt-2" : "max-h-0 opacity-0"}`}
      >
        {open && <div data-testid={`${testid}-body`}>{children}</div>}
      </div>
    </section>
  );
}
