import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_STYLES, type OperationStatus } from "@/lib/stocksense";

export interface OperationStatusBadgeProps {
  status?: OperationStatus | string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
  showDot?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  WAITING: "Waiting",
  READY: "Ready",
  DONE: "Done",
  CANCELED: "Canceled",
};

const DOT_COLORS: Record<string, string> = {
  DRAFT: "bg-muted-foreground/60",
  WAITING: "bg-amber-500 animate-pulse",
  READY: "bg-blue-500 animate-pulse",
  DONE: "bg-emerald-500",
  CANCELED: "bg-destructive",
};

const SIZE_STYLES: Record<"sm" | "default" | "lg", string> = {
  sm: "text-[11px] px-2 py-0.5 font-medium gap-1",
  default: "text-xs px-2.5 py-0.5 font-medium gap-1.5",
  lg: "text-sm px-3 py-1 font-semibold gap-2",
};

export const OperationStatusBadge: React.FC<OperationStatusBadgeProps> = ({
  status,
  className,
  size = "default",
  showDot = true,
}) => {
  if (!status) return null;

  const normalizedKey = String(status).toUpperCase();
  const label = STATUS_LABELS[normalizedKey] || normalizedKey;
  const style =
    STATUS_STYLES[normalizedKey as OperationStatus] || "bg-muted text-muted-foreground";
  const dotColor = DOT_COLORS[normalizedKey] || "bg-current";

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center border-0 select-none transition-colors",
        style,
        SIZE_STYLES[size],
        className,
      )}
    >
      {showDot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </Badge>
  );
};
