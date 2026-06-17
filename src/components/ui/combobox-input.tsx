import { useState, useRef, useMemo, useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";

interface ComboboxInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** Minimum characters before suggestions are shown (default 1). */
  minChars?: number;
  className?: string;
  id?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Free-text autocomplete: shows existing options as case-insensitive substring
 * matches, lets the user pick one OR type a brand-new value and keep it.
 */
export function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  minChars = 1,
  className,
  id,
}: ComboboxInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const generatedId = useId();
  const listId = id ?? generatedId;

  const query = value.trim().toLowerCase();

  // De-duplicate options case-insensitively, preserving clean display.
  const uniqueOptions = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((o) => {
      const clean = o.trim();
      if (!clean) return;
      const key = norm(clean);
      if (!map.has(key)) map.set(key, clean);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [options]);

  const matches = useMemo(() => {
    if (query.length < minChars) return uniqueOptions;
    return uniqueOptions.filter((o) => o.toLowerCase().includes(query));
  }, [uniqueOptions, query, minChars]);

  const exactExists = useMemo(
    () => uniqueOptions.some((o) => norm(o) === norm(value)),
    [uniqueOptions, value]
  );

  const showAddNew = value.trim().length > 0 && !exactExists;
  const showList = open && (matches.length > 0 || showAddNew);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    const total = matches.length + (showAddNew ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % Math.max(total, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + total) % Math.max(total, 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      if (highlight < matches.length) select(matches[highlight]);
      else select(value.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        id={listId}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
          onMouseDown={(e) => {
            e.preventDefault();
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {matches.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent",
                  highlight === i && "bg-accent"
                )}
                onClick={() => select(o)}
              >
                <Check className={cn("h-4 w-4 shrink-0", norm(o) === norm(value) ? "opacity-100" : "opacity-0")} />
                {o}
              </button>
            </li>
          ))}
          {showAddNew && (
            <li>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-primary hover:bg-accent",
                  highlight === matches.length && "bg-accent"
                )}
                onClick={() => select(value.trim())}
              >
                <Plus className="h-4 w-4 shrink-0" />
                Add new: <span className="font-medium">{value.trim()}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
