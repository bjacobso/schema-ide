import type { ComponentProps } from "react";
import { cn } from "./utils";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border text-foreground",
};

export interface BadgeProps extends ComponentProps<"span"> {
  readonly variant?: BadgeVariant | undefined;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
