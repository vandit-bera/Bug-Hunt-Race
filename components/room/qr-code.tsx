"use client";

import { useMemo } from "react";
import { cn } from "@/components/ui/cn";
import { createQrMatrix } from "./qr";

const QUIET_ZONE = 2;

/** Black on white at all times: scanners need the contrast, even in dark mode. */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const path = useMemo(() => {
    const matrix = createQrMatrix(value);
    let d = "";
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (matrix.isDark(x, y)) {
          d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
        }
      }
    }
    return { d, total: matrix.size + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${path.total} ${path.total}`}
      shapeRendering="crispEdges"
      className={cn("rounded-lg border-2 border-border bg-white", className)}
    >
      <path d={path.d} fill="#000" />
    </svg>
  );
}
