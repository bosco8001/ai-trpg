export type IconName = "quill" | "backpack" | "equipment" | "party" | "settings" | "close";

export function Icon({ name }: { name: IconName }) {
  const common = {
    className: "ui-icon",
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  if (name === "quill") return <svg {...common}><path d="M20 4c-5 1-8.5 4.5-10.5 10.5L4 20l5.5-1.5C15.5 16.5 19 13 20 4Z" /><path d="m8 16 4-4" /></svg>;
  if (name === "backpack") return <svg {...common}><path d="M8 7V5a4 4 0 0 1 8 0v2" /><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 12h6" /></svg>;
  if (name === "equipment") return <svg {...common}><path d="m14 5 5 5" /><path d="m4 20 11-11" /><path d="m3 21 3-1-2-2-1 3Z" /><path d="m13 6 2-2 5 5-2 2" /></svg>;
  if (name === "party") return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6" /><path d="M16 5a3 3 0 0 1 0 6" /><path d="M18 14c1.6.6 2.4 2.3 2.5 4.5" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H5v-3h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L8.5 6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4.5h3v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v3h-.2a1.7 1.7 0 0 0-1.4 1Z" /></svg>;
  return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
