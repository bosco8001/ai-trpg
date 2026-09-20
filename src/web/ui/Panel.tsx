import type { HTMLAttributes, ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Panel({ className, children, ...rest }: PanelProps) {
  return (
    <section {...rest} className={["ui-panel", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
