import { ArrowUp, Stop } from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";

/** The chat field at the bottom of the agent and new-Play pages: Enter sends, Shift+Enter breaks a line. */
export function Composer({
  placeholder,
  disabled,
  onSend,
  onStop,
  autoFocus,
}: {
  placeholder: string;
  disabled: boolean;
  onSend: (text: string) => void;
  /** Shown instead of Send while the agent works. */
  onStop?: () => void;
  autoFocus?: boolean;
}) {
  const t = useT("shell");
  const [text, setText] = useState("");
  const ready = Boolean(text.trim()) && !disabled;
  const submit = () => {
    if (!ready) return;
    onSend(text.trim());
    setText("");
  };
  const stopping = disabled && onStop;
  return (
    <div className="px-3 pt-2 pb-3 sm:px-4 sm:pb-5">
      <div
        className={cn(
          // A square of paper lifted off the plate; the ultramarine outline only while focused.
          "glass mx-auto flex max-w-2xl items-end gap-2 bg-field py-1.5 pr-1.5 pl-4",
          "outline-offset-2 outline-accent focus-within:outline-3",
          disabled && "ai-glow",
        )}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="max-h-48 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-base outline-none [field-sizing:content] placeholder:text-faint"
        />
        <button
          aria-label={stopping ? t("composer.stop") : t("composer.send")}
          onClick={stopping ? onStop : submit}
          disabled={!stopping && !ready}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center",
            "transition-[background-color,color,scale,opacity] duration-150 ease-out motion-safe:enabled:active:scale-90",
            stopping
              ? "bg-ink text-canvas"
              : ready
                ? "bg-accent text-on-accent hover:bg-accent-press"
                : "bg-control text-faint",
          )}
        >
          {/* The icons swap in place, so the button morphs instead of jumping. */}
          <span key={stopping ? "stop" : "send"} className="flex motion-safe:animate-[icon-in_200ms_var(--ease-out)]">
            {stopping ? <Stop size={12} weight="fill" /> : <ArrowUp size={16} weight="bold" />}
          </span>
        </button>
      </div>
    </div>
  );
}
