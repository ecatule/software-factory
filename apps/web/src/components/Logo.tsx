import logoFullUrl from "@/assets/logo-full.png";
import logoIconUrl from "@/assets/logo-icon.png";
import { cn } from "@/lib/utils";

// follow-up: these are pre-cropped, pre-resized exports (via `sharp`) of the
// source PNG (apps/web/src/assets/logo.png) — NOT the same file scaled at
// runtime via CSS `background-size`. An earlier version cropped/scaled the
// original 1376×768 source live in the browser (background-position math);
// visually it was correctly cropped (verified via screenshot) but looked
// soft/"distorted" at the small on-screen size because the browser was
// downscaling ~9x at render time. Pre-resizing once, offline, at ~4x the
// largest actual on-screen height (Lanczos resampling) fixes that — the
// browser now does a much gentler, higher-quality downscale (or none at
// all on standard-DPI screens). Source crop coordinates (pixel-measured on
// the 1376×768 original): full lockup {x:21,y:220,w:1334,h:305}, icon-only
// {x:21,y:220,w:260,h:305} — kept here only as a reference if the source
// logo is ever replaced and these need regenerating.
const ASPECT = { full: 612 / 140, icon: 119 / 140 };

interface LogoProps {
  /** "full" = icon + "DevFactoryAI" wordmark. "icon" = just the mark (collapsed sidebar). */
  variant?: "full" | "icon";
  /** Rendered height in px — width follows the asset's own aspect ratio. */
  height?: number;
  className?: string;
}

/**
 * follow-up: the logo's ink is dark navy, invisible against a dark-mode
 * background — `backgroundColor: white` on the img itself keeps it legible
 * in both themes (the source has no alpha channel; a permanent white
 * backing is invisible in light mode anyway, since the surrounding chrome
 * is already near-white there).
 */
export function Logo({ variant = "full", height = 24, className }: LogoProps) {
  const src = variant === "icon" ? logoIconUrl : logoFullUrl;
  const width = Math.round(height * ASPECT[variant]);

  return (
    <img
      src={src}
      alt="DevFactoryAI"
      width={width}
      height={height}
      className={cn("inline-block shrink-0 grow-0 rounded-md bg-white object-contain", className)}
      style={{ width, height }}
    />
  );
}
