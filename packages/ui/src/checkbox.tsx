import FormControlLabel from "@mui/material/FormControlLabel";
import MuiCheckbox from "@mui/material/Checkbox";
import type { CheckboxProps as MuiCheckboxProps } from "@mui/material/Checkbox";
import type { ReactNode } from "react";

export interface CheckboxProps extends Omit<MuiCheckboxProps, "checked" | "onChange"> {
  readonly checked: boolean;
  readonly label?: ReactNode | undefined;
  readonly onCheckedChange: (checked: boolean) => void;
}

export function Checkbox({ checked, className, label, onCheckedChange, ...props }: CheckboxProps) {
  const control = (
    <MuiCheckbox
      checked={checked}
      className={label ? undefined : className}
      onChange={(event) => onCheckedChange(event.target.checked)}
      {...props}
    />
  );

  if (!label) return control;

  return <FormControlLabel className={className} control={control} label={label} />;
}
