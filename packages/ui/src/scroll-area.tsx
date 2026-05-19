import type { ComponentProps } from "react";
import { cn } from "./utils";

export function ScrollArea({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("overflow-auto", className)} {...props} />;
}
