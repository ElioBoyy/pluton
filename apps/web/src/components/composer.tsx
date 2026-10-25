import { ArrowUp, Stop } from "@phosphor-icons/react";
import { useState } from "react";
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
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className="border-t border-line p-3 sm:p-4">
      <div
        className={cn(
          "mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-line bg-panel p-2 focus-within:border-line-strong",
          disabled && "ai-glow",
        )}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-faint"
        />
        {disabled && onStop ? (
          <button
            aria-label="Stop"
            onClick={onStop}
            className="flex size-8 items-center justify-center rounded-full bg-control text-ink hover:bg-control-hover"
          >
            <Stop size={14} weight="fill" />
          </button>
        ) : (
        <button
          aria-label="Send"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
        >
          <ArrowUp size={15} weight="bold" />
        </button>
        )}
      </div>
    </div>
  );
}
