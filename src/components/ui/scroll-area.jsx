import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A scroll container with a scroll indicator that is ALWAYS visible while
 * there's more to scroll, so people can see straight away that the content
 * continues. iOS only shows its own scroll indicator while you're actually
 * scrolling (and ignores ::-webkit-scrollbar styling), so the native bar is
 * hidden and a thin custom track + thumb is drawn instead. It tracks the
 * scroll position, and disappears when everything fits.
 *
 * className      → classes for the scrolling element (padding etc.)
 * trackClassName → position of the track inside the wrapper
 */
export default function ScrollArea({ className, trackClassName = "top-6 bottom-6 right-2", children }) {
  const ref = useRef(null);
  const [bar, setBar] = useState(null); // { top, height } in % of the track

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight + 1) { setBar(null); return; }
      const height = Math.max((clientHeight / scrollHeight) * 100, 12);
      const top = (scrollTop / (scrollHeight - clientHeight)) * (100 - height);
      setBar({ top, height });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) {
      ro.observe(el);
      [...el.children].forEach((c) => ro.observe(c));
    }
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="relative min-h-0 flex flex-col">
      <div ref={ref} className={cn("min-h-0 overflow-y-auto hide-scrollbar", className)}>
        {children}
      </div>
      {bar && (
        <div aria-hidden className={cn("pointer-events-none absolute w-1 rounded-full bg-white/10", trackClassName)}>
          <div className="absolute inset-x-0 rounded-full bg-violet-400/70"
            style={{ top: `${bar.top}%`, height: `${bar.height}%` }} />
        </div>
      )}
    </div>
  );
}
