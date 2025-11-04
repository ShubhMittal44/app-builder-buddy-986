import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: number;
  onChange?: (value: number) => void;
  currency?: string;
}

export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(({ value = 0, onChange, currency = "₹", className, ...props }, ref) => {
  const [displayValue, setDisplayValue] = React.useState("");

  React.useEffect(() => {
    if (value === 0 || value === undefined) {
      setDisplayValue("");
    } else {
      setDisplayValue(value.toLocaleString("en-IN"));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    
    if (rawValue === "") {
      setDisplayValue("");
      onChange?.(0);
      return;
    }

    const numericValue = parseInt(rawValue, 10);
    setDisplayValue(numericValue.toLocaleString("en-IN"));
    onChange?.(numericValue);
  };

  const handleBlur = () => {
    if (displayValue === "") {
      onChange?.(0);
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        {currency}
      </span>
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn("pl-8", className)}
        {...props}
      />
    </div>
  );
});

CurrencyInput.displayName = "CurrencyInput";
