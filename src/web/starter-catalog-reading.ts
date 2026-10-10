/** Reading intent for this sheet only; native reflow/clamping is not a reading command. */
export function observeStarterReading(
  dialog: HTMLDialogElement,
  scrollers: HTMLElement[],
  recordScroll: (reading: boolean) => void,
  readingEnded: (moved: boolean) => void,
) {
  let reading = false, disposed = false, internalScroll = 0;
  let readingMoved = false;
  const positions = new Map<HTMLElement, number>();
  let quietTimer: number | null = null;
  let pointer: { id: number; x: number; y: number; scrollbar: boolean } | null = null;
  let restoreFocusedScroll: (() => void) | null = null;
  const restorations: Array<() => void> = [];
  const clearQuietTimer = () => {
    if (quietTimer !== null) window.clearTimeout(quietTimer);
    quietTimer = null;
  };
  const endReading = () => {
    clearQuietTimer();
    if (pointer || !reading || disposed) return;
    reading = false;
    readingEnded(readingMoved);
  };
  const waitForEnd = () => {
    clearQuietTimer();
    // Also settle no-op commands and browsers without scrollend. Scroll events renew this.
    quietTimer = window.setTimeout(endReading, 250);
  };
  const beginReading = () => {
    if (disposed || internalScroll) return;
    if (!reading) {
      readingMoved = false;
      for (const element of scrollers) positions.set(element, element.scrollTop);
    }
    reading = true;
    waitForEnd();
  };
  const programmaticScroll = (apply: () => unknown) => {
    if (disposed || internalScroll) return apply();
    beginReading();
    try { return apply(); }
    finally {
      // A scroll event may arrive after the resize rAF. Read the requested position now.
      if (scrollers.some(element => element.scrollTop !== positions.get(element))) {
        readingMoved = true;
        recordScroll(true);
        for (const element of scrollers) positions.set(element, element.scrollTop);
      }
      waitForEnd();
    }
  };
  const wrapMethod = (element: HTMLElement, key: "scroll" | "scrollTo" | "scrollBy" | "scrollIntoView") => {
    const own = Object.getOwnPropertyDescriptor(element, key);
    if (own && !own.configurable) return () => {};
    const original = element[key];
    const wrapped = function (this: HTMLElement, ...args: unknown[]) {
      const apply = () => Reflect.apply(original, this, args);
      return this === element ? programmaticScroll(apply) : apply();
    };
    Object.defineProperty(element, key, { configurable: true, writable: true,
      enumerable: own?.enumerable ?? false, value: wrapped });
    return () => {
      if (Object.getOwnPropertyDescriptor(element, key)?.value !== wrapped) return;
      if (own) Object.defineProperty(element, key, own);
      else Reflect.deleteProperty(element, key);
    };
  };
  for (const element of scrollers) {
    const own = Object.getOwnPropertyDescriptor(element, "scrollTop");
    const accessor = own ?? Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    const get = accessor?.get, set = accessor?.set;
    if ((!own || own.configurable) && get && set) {
      const wrappedSet = function (this: HTMLElement, value: number) {
        const apply = () => set.call(this, value);
        if (this === element) programmaticScroll(apply);
        else apply();
      };
      Object.defineProperty(element, "scrollTop", { configurable: true,
        enumerable: accessor?.enumerable ?? false, get, set: wrappedSet });
      restorations.push(() => {
        if (Object.getOwnPropertyDescriptor(element, "scrollTop")?.set !== wrappedSet) return;
        if (own) Object.defineProperty(element, "scrollTop", own);
        else Reflect.deleteProperty(element, "scrollTop");
      });
    }
    for (const key of ["scroll", "scrollTo", "scrollBy"] as const)
      restorations.push(wrapMethod(element, key));
  }
  const focusChanged = () => {
    clearQuietTimer(); reading = Boolean(pointer?.scrollbar);
    if (reading) waitForEnd();
    restoreFocusedScroll?.(); restoreFocusedScroll = null;
    const active = document.activeElement;
    if (active instanceof HTMLElement && dialog.contains(active))
      restoreFocusedScroll = wrapMethod(active, "scrollIntoView");
  };
  const scroll = (event: Event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement) || !scrollers.includes(element)) return;
    const moved = positions.get(element) !== element.scrollTop;
    if (reading && moved && !internalScroll) readingMoved = true;
    recordScroll(reading && moved && !internalScroll);
    positions.set(element, element.scrollTop);
    if (reading) waitForEnd();
  };
  const scrollEnd = (event: Event) => {
    if (scrollers.includes(event.target as HTMLElement)) endReading();
  };
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && (event.deltaX || event.deltaY)) beginReading();
  };
  const pointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    const scrollbar = scrollers.some(element => event.target === element);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, scrollbar };
    if (scrollbar) beginReading();
  };
  const pointerMove = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.scrollbar || Math.abs(event.clientX - pointer.x) > 2 || Math.abs(event.clientY - pointer.y) > 2)
      beginReading();
  };
  const pointerUp = (event: PointerEvent) => {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    if (reading) waitForEnd();
  };
  const key = (event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
    const scrollingKey = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key);
    const scrollingSpace = event.key === " " && !(target instanceof HTMLElement && target.closest("button, summary, a"));
    if (!event.ctrlKey && !event.metaKey && !event.altKey && (scrollingKey || scrollingSpace)) beginReading();
  };
  dialog.addEventListener("focusin", focusChanged);
  dialog.addEventListener("scroll", scroll, true);
  dialog.addEventListener("scrollend", scrollEnd, true);
  dialog.addEventListener("wheel", wheel, { capture: true, passive: true });
  dialog.addEventListener("pointerdown", pointerDown, true);
  dialog.addEventListener("keydown", key, true);
  window.addEventListener("pointermove", pointerMove, { capture: true, passive: true });
  window.addEventListener("pointerup", pointerUp, true);
  window.addEventListener("pointercancel", pointerUp, true);
  focusChanged();
  return {
    isReading: () => reading,
    repair: (apply: () => void) => {
      internalScroll++;
      try { apply(); } finally { internalScroll--; }
    },
    dispose: () => {
      disposed = true; clearQuietTimer(); pointer = null; reading = false;
      restoreFocusedScroll?.();
      for (const restore of restorations.reverse()) restore();
      dialog.removeEventListener("focusin", focusChanged);
      dialog.removeEventListener("scroll", scroll, true);
      dialog.removeEventListener("scrollend", scrollEnd, true);
      dialog.removeEventListener("wheel", wheel, true);
      dialog.removeEventListener("pointerdown", pointerDown, true);
      dialog.removeEventListener("keydown", key, true);
      window.removeEventListener("pointermove", pointerMove, true);
      window.removeEventListener("pointerup", pointerUp, true);
      window.removeEventListener("pointercancel", pointerUp, true);
    },
  };
}
