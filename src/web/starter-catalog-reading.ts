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
  // Geometry is an observation, not evidence of a reading command. In particular,
  // an intermediate native maximum may never reach any JS callback.
  const positions = new Map<HTMLElement, Position>(scrollers.map(element => [element, sample(element)]));
  const sameLayout = (a: Position, b: Position) => a.maximum === b.maximum
    && a.width === b.width && a.height === b.height && a.content === b.content;
  type Ticket = { origin: Position; direction: number; kind: "input" | "api" };
  const tickets = new Map<HTMLElement, Ticket>();
  const movedElements = new Set<HTMLElement>();
  // A layout rAF can precede passive wheel delivery. Retain its uncredited delta
  // briefly, without treating that delta itself as a reading command.
  const uncredited = new Map<HTMLElement, { origin: Position; current: Position; time: number }>();
  const rememberPositions = (elements = scrollers) => {
    for (const element of elements) positions.set(element, sample(element));
  };
  let quietTimer: number | null = null;
  let pointer: { id: number; y: number; lastY: number; scrollbar: boolean; dragging: boolean } | null = null;
  let restoreFocusedScroll: (() => void) | null = null;
  const restorations: Array<() => void> = [];
  const clearQuietTimer = () => {
    if (quietTimer !== null) window.clearTimeout(quietTimer);
    quietTimer = null;
  };
  const endReading = () => {
    clearQuietTimer();
    if (pointer?.scrollbar || pointer?.dragging || !reading || disposed) return;
    reading = false;
    tickets.clear(); movedElements.clear();
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
      movedElements.clear();
    }
    reading = true;
    waitForEnd();
  };
  const confirmReading = (elements: HTMLElement[]) => {
    if (disposed || internalScroll) return;
    beginReading(); readingMoved = true;
    for (const element of elements) movedElements.add(element);
    recordScroll(true);
  };
  const canMove = (position: Position, direction: number) => direction < 0
    ? position.top > 0 : direction > 0 && position.top < position.maximum;
  const arm = (element: HTMLElement, origin: Position, direction: number, kind: Ticket["kind"] = "input") => {
    if (!canMove(origin, direction)) return;
    beginReading();
    tickets.set(element, { origin, direction, kind });
  };
  const replaceTickets = (elements = scrollers) => {
    for (const element of elements) tickets.delete(element);
    if (reading && !readingMoved && !tickets.size) endReading();
  };
  const observePosition = (element: HTMLElement, allowTicket: boolean, retainDelta = true) => {
    const before = positions.get(element), after = sample(element);
    positions.set(element, after);
    const ticket = tickets.get(element);
    if (ticket && !sameLayout(ticket.origin, after)) tickets.delete(element);
    if (!internalScroll && allowTicket && ticket && sameLayout(ticket.origin, after)
      && after.top !== ticket.origin.top
      && (ticket.direction === 0 || (after.top - ticket.origin.top) * ticket.direction > 0)) {
      // Keep the command's origin separate from layout samples: a rAF may have
      // observed the displacement before the delayed native scroll event arrives.
      tickets.set(element, { ...ticket, origin: after });
      uncredited.delete(element);
      confirmReading([element]); return true;
    }
    if (before && before.top !== after.top && !internalScroll) {
      if (retainDelta && sameLayout(before, after)) {
        const earlier = uncredited.get(element);
        const now = performance.now();
        const continuous = earlier && now - earlier.time <= 250 && sameLayout(earlier.current, before)
          && (after.top - before.top) * (earlier.current.top - earlier.origin.top) > 0;
        uncredited.set(element, { origin: continuous ? earlier.origin : before, current: after, time: now });
      } else uncredited.delete(element);
      recordScroll(false);
    }
    return false;
  };
  const observePositions = (retainDelta = true) => {
    for (const element of scrollers) observePosition(element, false, retainDelta);
  };
  // Only ordinary finite data options can prove a delayed smooth request can move.
  // Do not re-read option getters or coerce values a second time. Opaque options
  // still go to the native API unchanged, but have no delayed ownership guarantee.
  const smoothDirection = (key: string, args: unknown[], origin: Position) => {
    try {
      const options = args[0];
      if (!options || typeof options !== "object") return 0;
      if (Object.getOwnPropertyDescriptor(options, "behavior")?.value !== "smooth") return 0;
      const top = Object.getOwnPropertyDescriptor(options, "top")?.value;
      if (typeof top !== "number" || !Number.isFinite(top)) return 0;
      const requested = key === "scrollBy" ? origin.top + top : top;
      const destination = Math.max(0, Math.min(origin.maximum, requested));
      return Math.sign(destination - origin.top);
    } catch { return 0; } // Descriptor traps must not replace the native result/exception.
  };
  const programmaticScroll = (apply: () => unknown, key = "scrollTop", args: unknown[] = [], target?: HTMLElement) => {
    if (disposed || internalScroll) return apply();
    const affected = scrollers.filter(element => key === "scrollIntoView"
      ? target !== undefined && element.contains(target) : element === target);
    replaceTickets(affected);
    for (const element of affected) observePosition(element, false, false);
    for (const element of affected) uncredited.delete(element);
    const before = new Map<HTMLElement, Position>(affected.map(element => [element, sample(element)]));
    let completed = false;
    try { const result = apply(); completed = true; return result; }
    finally {
      if (!disposed) {
        const moved = affected.filter(element => {
          const origin = before.get(element);
          return origin !== undefined && element.scrollTop !== origin.top;
        });
        if (moved.length) confirmReading(moved);
        if (completed && key !== "scrollTop" && key !== "scrollIntoView") {
          for (const element of affected) {
            const origin = before.get(element);
            if (origin && (element === target || key === "scrollIntoView"))
              arm(element, origin, smoothDirection(key, args, origin), "api");
          }
        }
        // A no-op setter, invalid/coerced method or thrown call cannot grant ownership.
        rememberPositions(affected);
      }
    }
  };
  const wrapMethod = (element: HTMLElement, key: "scroll" | "scrollTo" | "scrollBy" | "scrollIntoView") => {
    const own = Object.getOwnPropertyDescriptor(element, key);
    if (own && !own.configurable) return () => {};
    const original = element[key];
    const wrapped = function (this: HTMLElement, ...args: unknown[]) {
      const apply = () => Reflect.apply(original, this, args);
      return this === element ? programmaticScroll(apply, key, args, element) : apply();
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
        if (this === element) programmaticScroll(apply, "scrollTop", [], element);
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
    tickets.clear(); movedElements.clear(); uncredited.clear();
    if (!reading) { readingMoved = false; rememberPositions(); }
    if (reading) {
      for (const element of scrollers) tickets.set(element, { origin: sample(element), direction: 0, kind: "input" });
      waitForEnd();
    }
    restoreFocusedScroll?.(); restoreFocusedScroll = null;
    const active = document.activeElement;
    if (active instanceof HTMLElement && dialog.contains(active))
      restoreFocusedScroll = wrapMethod(active, "scrollIntoView");
  };
  const scroll = (event: Event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement) || !scrollers.includes(element)) return;
    observePosition(element, true);
    if (reading) waitForEnd();
  };
  const scrollEnd = (event: Event) => {
    const element = event.target as HTMLElement;
    if (!scrollers.includes(element)) return;
    observePosition(element, true);
    const participated = tickets.has(element) || movedElements.has(element);
    tickets.delete(element); movedElements.delete(element);
    // An input may have candidate ancestors which never moved. They need not keep
    // an ended gesture alive; another actually moving scroller still does.
    if (participated && !movedElements.size) {
      for (const [candidate, ticket] of tickets) if (ticket.kind === "input") tickets.delete(candidate);
      if (!tickets.size) endReading();
    }
  };
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || !event.deltaY) return;
    replaceTickets();
    const direction = Math.sign(event.deltaY);
    for (const element of scrollers) {
      const observed = positions.get(element), after = sample(element), earlier = uncredited.get(element);
      const before = observed && observed.top !== after.top ? observed
        : earlier && canMove(after, direction) && performance.now() - earlier.time <= 250 && earlier.current.top === after.top
          && sameLayout(earlier.current, after) ? earlier.origin : observed;
      // The compositor can move before a passive listener. Credit that movement
      // only for this known wheel direction and unchanged observed geometry.
      if (before && sameLayout(before, after) && canMove(before, direction)
        && (after.top - before.top) * direction > 0) confirmReading([element]);
      else if (before && before.top !== after.top) recordScroll(false);
      positions.set(element, after);
      uncredited.delete(element);
      arm(element, after, direction);
    }
  };
  const pointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    const scrollbar = scrollers.some(element => event.target === element);
    pointer = { id: event.pointerId, y: event.clientY, lastY: event.clientY, scrollbar, dragging: false };
    if (scrollbar) {
      uncredited.clear();
      replaceTickets();
      beginReading();
      for (const element of scrollers) {
        const origin = sample(element);
        tickets.set(element, { origin, direction: 0, kind: "input" });
      }
    }
  };
  const pointerMove = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.scrollbar || pointer.dragging || Math.abs(event.clientY - pointer.y) > 2) {
      const direction = pointer.scrollbar ? 0 : Math.sign(pointer.lastY - event.clientY);
      pointer.lastY = event.clientY;
      if (!pointer.scrollbar && !direction) return;
      pointer.dragging = !pointer.scrollbar;
      beginReading();
      for (const element of scrollers) {
        const before = positions.get(element), after = sample(element);
        if (before && sameLayout(before, after) && before.top !== after.top
          && (direction === 0 || (after.top - before.top) * direction > 0)) confirmReading([element]);
        tickets.set(element, { origin: after, direction, kind: "input" });
        positions.set(element, after);
      }
    }
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
    if (!event.ctrlKey && !event.metaKey && !event.altKey && (scrollingKey || scrollingSpace)) {
      uncredited.clear();
      replaceTickets();
      const direction = ["ArrowUp", "PageUp", "Home"].includes(event.key) || (scrollingSpace && event.shiftKey) ? -1 : 1;
      for (const element of scrollers) arm(element, sample(element), direction);
    }
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
    layoutChanged: () => {
      if (disposed) return;
      // A no-op command before reflow must not adopt an unseen intermediate clamp.
      // Keep its last confirmed focus baseline; only a new command can own movement.
      clearQuietTimer(); tickets.clear(); movedElements.clear(); uncredited.clear();
      reading = Boolean(pointer?.scrollbar || pointer?.dragging); readingMoved = false;
      observePositions(false);
    },
    sampleLayout: () => { if (!disposed) observePositions(); },
    repair: (apply: () => void) => {
      internalScroll++;
      try { apply(); } finally { rememberPositions(); tickets.clear(); uncredited.clear(); internalScroll--; }
    },
    dispose: () => {
      disposed = true; clearQuietTimer(); pointer = null; reading = false;
      tickets.clear(); movedElements.clear(); uncredited.clear();
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
