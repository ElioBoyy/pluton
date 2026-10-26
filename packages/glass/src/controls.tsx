import type { AnchorHTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.ts";

type Variant = "accent" | "glass" | "plain" | "quiet";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; iconOnly?: boolean };

const buttonClass = (variant: Variant, size: Size, iconOnly: boolean | undefined, className?: string) =>
  cx("gg-button", `gg-button--${variant}`, size !== "md" && `gg-button--${size}`, iconOnly && "gg-button--icon", className);

/** A capsule button. `accent` is the one thing to press; `glass` sits over pictures; `plain` sits inside glass. */
export function Button({ variant = "plain", size = "md", iconOnly, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, iconOnly, className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size };

/** A link that looks like a Button, for actions that go somewhere. */
export function LinkButton({ variant = "plain", size = "md", className, ...props }: LinkButtonProps) {
  return <a className={buttonClass(variant, size, false, className)} {...props} />;
}

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  /** Read by screen readers as the group's name. */
  label: string;
  /** Lets `wireGlass` find the control when it is rendered without React state (the landing page). */
  name?: string;
  className?: string;
};

/** A row of mutually exclusive choices in a capsule; the chosen one is raised. */
export function Segmented<T extends string>({ options, value, onChange, label, name, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("gg-segmented", className)} data-gg-segmented={name}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="gg-segmented__option"
          data-value={o.value}
          onClick={onChange && (() => onChange(o.value))}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
};

export function Switch({ checked, onChange, label, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx("gg-switch", className)}
      data-gg-switch=""
      onClick={onChange && (() => onChange(!checked))}
      {...props}
    />
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { trailing?: ReactNode; fieldClassName?: string };

/** A text field set into the glass, with room for a button at its end. */
export function Field({ trailing, fieldClassName, className, ...props }: FieldProps) {
  return (
    <div className={cx("gg-field", fieldClassName)}>
      <input className={cx("gg-field__input", className)} {...props} />
      {trailing}
    </div>
  );
}

/** A suggestion or filter: a small capsule of thin glass. */
export function Chip({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx("gg-chip", className)} {...props} />;
}
