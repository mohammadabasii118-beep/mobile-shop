"use client";

import { useState } from "react";

/**
 * Optional cinematic advertising backdrop.
 *
 * Renders an image from /public/images/advertising/** when the file exists.
 * If the file is missing (404) it silently removes itself via onError, so the
 * underlying 3D scene / dark background remains as a graceful fallback.
 *
 * → Swapping art later = just drop the file at `src`. No code changes needed.
 */
export default function AdBackdrop({
  src,
  className = "",
  overlay = true,
  opacity = 0.55,
}: {
  src: string;
  className?: string;
  overlay?: boolean;
  opacity?: number;
}) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={() => setOk(false)}
        className="h-full w-full object-cover"
        style={{ opacity }}
      />
      {overlay && (
        // keeps text legible + enforces the black/silver identity over any art
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/60 via-ink-950/30 to-ink-950/85" />
      )}
    </div>
  );
}
