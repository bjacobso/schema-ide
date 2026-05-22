import MuiToggleButton from "@mui/material/ToggleButton";
import MuiToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ToggleButtonGroupProps as MuiToggleButtonGroupProps } from "@mui/material/ToggleButtonGroup";
import type { ReactNode } from "react";

export interface ToggleGroupOption {
  readonly disabled?: boolean | undefined;
  readonly label: ReactNode;
  readonly value: string;
}

export interface ToggleGroupProps extends Omit<
  MuiToggleButtonGroupProps,
  "children" | "exclusive" | "onChange" | "size" | "value"
> {
  readonly onValueChange: (value: string) => void;
  readonly options: readonly ToggleGroupOption[];
  readonly size?: "default" | "sm" | undefined;
  readonly value: string;
}

export function ToggleGroup({
  onValueChange,
  options,
  size = "default",
  value,
  ...props
}: ToggleGroupProps) {
  return (
    <MuiToggleButtonGroup
      exclusive
      onChange={(_, nextValue: string | null) => {
        if (nextValue !== null) onValueChange(nextValue);
      }}
      size={size === "sm" ? "small" : "medium"}
      value={value}
      {...props}
    >
      {options.map((option) => (
        <MuiToggleButton key={option.value} disabled={option.disabled} value={option.value}>
          {option.label}
        </MuiToggleButton>
      ))}
    </MuiToggleButtonGroup>
  );
}
