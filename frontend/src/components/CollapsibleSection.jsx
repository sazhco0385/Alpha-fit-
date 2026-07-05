import { useState } from "react";
import { ChevronDown } from "lucide-react";

/** Collapsible section wrapper for the Dashboard. Header stays visible; body toggles. */
export default function CollapsibleSection({
  title,
  icon: Icon,
  hint,
  defaultOpen = false,
  children,
  testid,
  headerRight = null,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-4 sm:mb-5" data-testid={testid}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
