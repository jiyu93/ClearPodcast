import { type MouseEvent, type ReactNode } from "react";

export function ButtonHitArea({ children }: { children: ReactNode }) {
  const handleHitAreaClick = (event: MouseEvent<HTMLSpanElement>) => {
    const button = event.currentTarget.querySelector("button");
    if (!button || button.disabled || !(event.target instanceof Node)) {
      return;
    }

    if (button.contains(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    button.focus({ preventScroll: true });
    button.click();
  };

  return (
    <span className="button-hit-area" onClick={handleHitAreaClick}>
      {children}
    </span>
  );
}
