"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";

type Choice = { value: string; label: string; icon: ReactNode; count?: number };
export default function ChoicePicker({
  choices,
  value,
  onChange,
  title,
  variant = "rooms",
  footer,
}: {
  choices: Choice[];
  value: string;
  onChange: (id: string) => void;
  title: string;
  variant?: "members" | "rooms";
  footer?: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 400 });
  const current = choices.find((choice) => choice.value === value);
  const placePanel = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      panel.current?.hidePopover();
      return;
    }
    const width = Math.min(380, window.innerWidth - 24);
    const top = rect.bottom + 8;
    setPosition({
      top,
      left: Math.max(
        12,
        Math.min(rect.right - width, window.innerWidth - width - 12),
      ),
      maxHeight: Math.max(120, window.innerHeight - top - 12),
    });
  };
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", placePanel);
    return () => window.removeEventListener("resize", placePanel);
  }, [open]);
  const close = () => {
    panel.current?.hidePopover();
    trigger.current?.focus();
  };
  const toggle = () => {
    if (open) return close();
    placePanel();
    panel.current?.showPopover();
    requestAnimationFrame(() =>
      panel.current
        ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
        ?.focus(),
    );
  };
  const navigate = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ),
    );
    const index = options.findIndex(
      (option) => option === document.activeElement,
    );
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    options[next]?.focus();
  };
  return (
    <div className={`choice-picker choice-picker-${variant}`}>
      <button
        ref={trigger}
        type="button"
        className={`choice-trigger ${open ? "is-open" : ""}`}
        aria-label={`${title}: ${current?.label ?? ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            toggle();
          }
        }}
      >
        {current?.icon}
        <span>{current?.label}</span>
        <ChevronDown size={15} />
      </button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        className={`choice-popover choice-popover-${variant}`}
        style={position}
        onToggle={(event) => setOpen(event.newState === "open")}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
      >
        <div className="choice-heading">
          <span>{title}</span>
          <button type="button" aria-label={`${title} 닫기`} onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div
          className="choice-options"
          role="menu"
          aria-label={title}
          onKeyDown={navigate}
        >
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="menuitemradio"
              aria-checked={choice.value === value}
              className={`choice-option ${choice.value === value ? "is-selected" : ""}`}
              onClick={() => {
                onChange(choice.value);
                close();
              }}
            >
              {choice.icon}
              <span className="choice-name">{choice.label}</span>
              {choice.count !== undefined && (
                <span className="choice-count">{choice.count}</span>
              )}
              {choice.value === value && (
                <span className="choice-check" aria-hidden="true">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        {footer && <div className="choice-footer">{footer}</div>}
      </div>
    </div>
  );
}
