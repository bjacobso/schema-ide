import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import MuiSelect, { type SelectChangeEvent } from "@mui/material/Select";
import type { SelectProps as MuiSelectProps } from "@mui/material/Select";
import type { ReactNode } from "react";

export interface SelectOption {
  readonly value: string;
  readonly label: ReactNode;
  readonly disabled?: boolean | undefined;
}

export interface SelectProps extends Omit<
  MuiSelectProps<string>,
  "children" | "label" | "onChange" | "size" | "value"
> {
  readonly "aria-label"?: string | undefined;
  readonly label?: string | undefined;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly size?: "default" | "sm" | undefined;
  readonly value: string;
}

export function Select({
  "aria-label": ariaLabel,
  className,
  fullWidth,
  label,
  onValueChange,
  options,
  size = "default",
  value,
  ...props
}: SelectProps) {
  const labelId = label ? `${props.id ?? props.name ?? "select"}-label` : undefined;

  return (
    <FormControl
      className={className}
      disabled={props.disabled}
      fullWidth={fullWidth}
      size={size === "sm" ? "small" : "medium"}
    >
      {label ? <InputLabel id={labelId}>{label}</InputLabel> : null}
      <MuiSelect
        {...props}
        inputProps={{ "aria-label": ariaLabel }}
        label={label}
        labelId={labelId}
        fullWidth={fullWidth}
        onChange={(event: SelectChangeEvent<string>) => onValueChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <MenuItem key={option.value} disabled={option.disabled} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </MuiSelect>
    </FormControl>
  );
}
