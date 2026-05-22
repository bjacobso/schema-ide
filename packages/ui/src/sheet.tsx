import { useEffect, type ComponentProps } from "react";
import { cn } from "./utils";

export type SheetSide = "top" | "right" | "bottom" | "left";

export interface SheetProps extends ComponentProps<"div"> {
  readonly open: boolean;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}

const sideClasses: Record<SheetSide, string> = {
  top: "inset-x-0 top-0 h-auto max-h-[85vh] border-b",
  right: "inset-y-0 right-0 h-full w-full max-w-md border-l",
  bottom: "inset-x-0 bottom-0 h-auto max-h-[85vh] border-t",
  left: "inset-y-0 left-0 h-full w-full max-w-md border-r",
};

export function Sheet({ open, onOpenChange, className, children, ...props }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange?.(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 z-50", className)} {...props}>
      <button
        aria-label="Close sheet"
        className="absolute inset-0 bg-background/60"
        type="button"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </div>
  );
}

export interface SheetContentProps extends ComponentProps<"section"> {
  readonly side?: SheetSide | undefined;
}

export function SheetContent({ side = "right", className, ...props }: SheetContentProps) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      className={cn(
        "fixed z-50 flex flex-col bg-background shadow-xl outline-none",
        sideClasses[side],
        className,
      )}
      {...props}
    />
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 border-b p-4", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center justify-end gap-2 border-t p-4", className)} {...props} />
  );
}
