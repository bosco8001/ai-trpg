/** Reading intent for this sheet only; native reflow/clamping is not a reading command. */
export function observeStarterReading(
  dialog: HTMLDialogElement,
  scrollers: HTMLElement[],
  recordScroll: (reading: boolean) => void,
  readingEnded: (moved: boolean) => void,
) {
  let reading = false, disposed = false, internalScroll = 0;
  let readingMoved = false;
  type Position = { top: number; maximum: number; width: number; height: number; content: number };
  const sample = (element: HTMLElement): Position => ({ top: element.scrollTop,
    maximum: Math.max(0, element.scrollHeight - element.clientHeight),
    width: element.clientWidth, height: element.clientHeight, content: element.scrollHeight });
  // Keep the last observation, including before passive wheel delivery. The compositor
  // may already have moved by the time an input listener gets control.
  const positions = new Map<HTMLElement, Position>(scrollers.map(element => [element, sample(element)]));
  const sameLayout = (a: Position, b: Position) => a.maximum === b.maximum
    && a.width === b.width && a.height === b.height && a.content === b.content;
  const rememberPositions = () => {
    for (const element of scrollers) positions.set(element, sample(element));
  };
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
    }
    reading = true;
    waitForEnd();
  };
  const observePosition = (element: HTMLElement) => {
    const before = positions.get(element), after = sample(element);
    positions.set(element, after);
    if (!before || before.top === after.top) return false;
    // A changed range can clamp a previously legal position. Capture it at each
    // layout notification, before a later layout grows the range again.
    const clamped = !sameLayout(before, after) && before.top > after.maximum
      && Math.abs(after.top - after.maximum) < 1;
    if (internalScroll || clamped) { recordScroll(false); return false; }
    // Unwrapped APIs and browser-originated reading still own their position.
    // This fallback never modifies global prototypes or installs descendant wrappers.
    beginReading(); readingMoved = true; recordScroll(true);
    return true;
  };
  const observePositions = () => {
    for (const element of scrollers) observePosition(element);
  };
  const programmaticScroll = (apply: () => unknown) => {
    if (disposed || internalScroll) return apply();
    observePositions();
    beginReading();
    const before = scrollers.map(element => element.scrollTop);
    try { return apply(); }
    finally {
      // A scroll event may arrive after the resize rAF. Read the requested position now.
      if (scrollers.some((element, index) => element.scrollTop !== before[index])) {
        readingMoved = true;
        recordScroll(true);
      }
      rememberPositions();
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
    if (!reading) { readingMoved = false; rememberPositions(); }
    if (reading) waitForEnd();
    restoreFocusedScroll?.(); restoreFocusedScroll = null;
    const active = document.activeElement;
    if (active instanceof HTMLElement && dialog.contains(active))
      restoreFocusedScroll = wrapMethod(active, "scrollIntoView");
  };
  const scroll = (event: Event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement) || !scrollers.includes(element)) return;
    // Do not assume that any scroll during an input session was caused by input.
    // A no-op End/setter followed by an orientation clamp is still native layout.
    observePosition(element);
    if (reading) waitForEnd();
  };
  const scrollEnd = (event: Event) => {
    if (scrollers.includes(event.target as HTMLElement)) endReading();
  };
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && (event.deltaX || event.deltaY)) {
      observePositions();
      beginReading();
    }
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
  const capture = { capture: true };
  const passiveCapture = { capture: true, passive: true };
  dialog.addEventListener("focusin", focusChanged);
  dialog.addEventListener("scroll", scroll, capture);
  dialog.addEventListener("scrollend", scrollEnd, capture);
  dialog.addEventListener("wheel", wheel, passiveCapture);
  dialog.addEventListener("pointerdown", pointerDown, capture);
  dialog.addEventListener("keydown", key, capture);
  window.addEventListener("pointermove", pointerMove, passiveCapture);
  window.addEventListener("pointerup", pointerUp, capture);
  window.addEventListener("pointercancel", pointerUp, capture);
  focusChanged();
  return {
    isReading: () => reading,
    observeLayout: () => { if (!disposed) observePositions(); },
    repair: (apply: () => void) => {
      internalScroll++;
      try { apply(); } finally { rememberPositions(); internalScroll--; }
    },
    dispose: () => {
      disposed = true; clearQuietTimer(); pointer = null; reading = false;
      restoreFocusedScroll?.();
      for (const restore of restorations.reverse()) restore();
      dialog.removeEventListener("focusin", focusChanged);
      dialog.removeEventListener("scroll", scroll, capture);
      dialog.removeEventListener("scrollend", scrollEnd, capture);
      dialog.removeEventListener("wheel", wheel, passiveCapture);
      dialog.removeEventListener("pointerdown", pointerDown, capture);
      dialog.removeEventListener("keydown", key, capture);
      window.removeEventListener("pointermove", pointerMove, passiveCapture);
      window.removeEventListener("pointerup", pointerUp, capture);
      window.removeEventListener("pointercancel", pointerUp, capture);
    },
  };
}
