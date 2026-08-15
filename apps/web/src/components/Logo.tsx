import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";

// follow-up: the source PNG (apps/web/src/assets/logo.png, 1376×768) has no
// alpha channel — it's a flat white background with a faint decorative
// watermark pattern behind the mark, not real transparency. These are the
// pixel-measured bounding boxes of just the actual ink (navy + cyan),
// computed once (see conversation) so the logo can be cropped via CSS
// `background-position`/`background-size` without re-encoding the PNG.
const ORIGINAL = { width: 1376, height: 768 };
const FULL_BBOX = { x: 62, y: 243, width: 1253, height: 274 };
const ICON_BBOX = { x: 62, y: 243, width: 273, height: 274 };

interface LogoProps {
  /** "full" = icon + "DevFactoryAI" wordmark. "icon" = just the mark (collapsed sidebar). */
  variant?: "full" | "icon";
  /** Rendered height in px — width follows the cropped region's own aspect ratio. */
  height?: number;
  className?: string;
}

/**
 * follow-up: the logo's ink is dark navy, invisible against a dark-mode
 * background — wrapped in a light chip (`dark:bg-white`) so it stays
 * legible in both themes instead of attempting to recolor the source PNG.
 */
export function Logo({ variant = "full", height = 24, className }: LogoProps) {
  const bbox = variant === "icon" ? ICON_BBOX : FULL_BBOX;
  const scale = height / bbox.height;
  const width = Math.round(bbox.width * scale);

  return (
    <span className={cn("inline-flex items-center rounded-md dark:bg-white dark:p-1", className)}>
      <span
        role="img"
        aria-label="DevFactoryAI"
        style={{
          display: "block",
          width,
          height,
          backgroundImage: `url(${logoUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${Math.round(ORIGINAL.width * scale)}px ${Math.round(ORIGINAL.height * scale)}px`,
          backgroundPosition: `-${Math.round(bbox.x * scale)}px -${Math.round(bbox.y * scale)}px`,
        }}
      />
    </span>
  );
}
