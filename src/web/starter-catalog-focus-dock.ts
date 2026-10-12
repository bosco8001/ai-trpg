type Rect = { left: number; right: number; top: number; bottom: number };
type DockBounds = Rect & { paddingTop: number; paddingBottom: number };

/** The same visible, padded bounds are used by focus observation and navigation. */
export function starterFocusViewportBounds(element: HTMLElement) {
  const rect = element.getBoundingClientRect(), style = window.getComputedStyle(element);
  const viewport = window.visualViewport;
  return {
    left: Math.max(rect.left, viewport?.offsetLeft ?? 0),
    right: Math.min(rect.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth)),
    top: Math.max(rect.top, viewport?.offsetTop ?? 0) + Math.max(8, Number.parseFloat(style.scrollPaddingTop) || 0),
    bottom: Math.min(rect.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight))
      - Math.max(8, Number.parseFloat(style.scrollPaddingBottom) || 0),
  };
}

export function starterFocusNavigationDelta(control: Rect, viewport: Rect) {
  // An oversized row cannot be fully contained; expose its beginning explicitly.
  if (control.bottom - control.top > viewport.bottom - viewport.top) return control.top - viewport.top;
  if (control.bottom > viewport.bottom) return control.bottom - viewport.bottom;
  if (control.top < viewport.top) return control.top - viewport.top;
  return 0;
}

/** Choose a legal absolute position; containment still uses the actual DOM rect. */
export function starterFocusNavigationTarget(control: Rect, viewport: Rect, current: number, maximum: number) {
  const limit = Math.max(0, maximum);
  const clamp = (value: number) => Math.min(limit, Math.max(0, value));
  const delta = starterFocusNavigationDelta(control, viewport);
  // Preserve an already-contained fractional position, including a no-op at a boundary.
  if (delta === 0) return clamp(current);
  const geometricTarget = clamp(current + delta);
  // An oversized row or a clamped range cannot be made fully visible by rounding.
  const minimum = Math.max(0, current + control.bottom - viewport.bottom);
  const maximumContained = Math.min(limit, current + control.top - viewport.top);
  if (minimum > maximumContained) return geometricTarget;
  const firstInteger = Math.ceil(minimum), lastInteger = Math.floor(maximumContained);
  // A fractional-only interval is valid geometry, not permission to overshoot it.
  if (firstInteger > lastInteger) return geometricTarget;
  // Select inside both edges rather than request an exact fractional boundary.
  // This does not assume every browser quantizes scrollTop to integer CSS pixels.
  const inwardTarget = delta > 0 ? Math.ceil(geometricTarget) : Math.floor(geometricTarget);
  return Math.min(lastInteger, Math.max(firstInteger, inwardTarget));
}

/** Geometry only; this does not identify why a viewport or scroll position changed. */
export function starterFocusDockPlacement(bounds: DockBounds, controlHeight: number) {
  const inset = 8;
  const left = bounds.left + inset, right = bounds.right - inset;
  const top = bounds.top + Math.max(inset, bounds.paddingTop);
  const bottom = bounds.bottom - Math.max(inset, bounds.paddingBottom);
  if (![left, right, top, bottom, controlHeight].every(Number.isFinite) || right <= left || bottom <= top) return null;
  const height = Math.min(Math.max(44, controlHeight), bottom - top);
  return { left, top: bottom - height, width: right - left, maxHeight: bottom - top };
}

/** Keep the actual focused node accessible without scrolling or changing focus. */
export function createStarterFocusDock(dialog: HTMLDialogElement) {
  type StyleWrite = { node: HTMLElement; key: string; previous: string; priority: string; value: string; writtenPriority: string };
  type DockState = { node: HTMLElement; placeholder: HTMLElement | null; writes: StyleWrite[];
    sourceHeight: number; sourceWidth: number; marginHeight: number; parentPadding: number; minimumPerRem: number };
  let docked: DockState | null = null;
  let disposed = false;
  let pointerId: number | null = null;
  let releasePending = false;
  const write = (state: DockState, node: HTMLElement, key: string, value: string) => {
    let saved = state.writes.find(item => item.node === node && item.key === key);
    if (!saved) {
      saved = { node, key, previous: node.style.getPropertyValue(key),
        priority: node.style.getPropertyPriority(key), value, writtenPriority: "" };
      state.writes.push(saved);
    }
    node.style.setProperty(key, value);
    // CSSOM may serialize a floating point length differently from its input.
    saved.value = node.style.getPropertyValue(key);
    saved.writtenPriority = node.style.getPropertyPriority(key);
  };
  const release = (force = true) => {
    if (!force && pointerId !== null) { releasePending = true; return; }
    releasePending = false;
    const state = docked;
    if (!state) return;
    docked = null;
    state.node.classList.remove("starter-catalog__focus-docked");
    state.placeholder?.remove();
    for (const item of state.writes.reverse()) {
      // Leave a later third-party inline override intact.
      if (item.node.style.getPropertyValue(item.key) !== item.value
        || item.node.style.getPropertyPriority(item.key) !== item.writtenPriority) continue;
      if (item.previous) item.node.style.setProperty(item.key, item.previous, item.priority);
      else item.node.style.removeProperty(item.key);
    }
  };
  const position = () => {
    const state = docked;
    if (!state || disposed || pointerId !== null) return;
    const rail = dialog.querySelector<HTMLElement>(".starter-catalog__focus-rail");
    if (!rail) { release(); return; }
    const bounds = rail.getBoundingClientRect(), padding = window.getComputedStyle(rail);
    const viewport = window.visualViewport;
    const visibleBounds = {
      left: Math.max(bounds.left, viewport?.offsetLeft ?? 0),
      right: Math.min(bounds.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth)),
      top: Math.max(bounds.top, viewport?.offsetTop ?? 0),
      bottom: Math.min(bounds.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)),
      paddingTop: 8,
      paddingBottom: 8 + (Number.parseFloat(padding.paddingBottom) || 0),
    };
    const placement = starterFocusDockPlacement(visibleBounds, state.sourceHeight);
    if (!placement || placement.maxHeight < 44) { release(); return; }
    // Match the source width so docking does not introduce different text wrapping.
    const parent = state.node.parentElement;
    const parentStyle = parent && window.getComputedStyle(parent);
    const sourceWidth = state.placeholder?.getBoundingClientRect().width
      ?? (parent && parentStyle ? parent.getBoundingClientRect().width
        - (Number.parseFloat(parentStyle.paddingLeft) || 0) - (Number.parseFloat(parentStyle.paddingRight) || 0)
        - (Number.parseFloat(parentStyle.borderLeftWidth) || 0) - (Number.parseFloat(parentStyle.borderRightWidth) || 0)
        : state.sourceWidth);
    const width = Math.min(placement.width, sourceWidth || state.sourceWidth);
    write(state, state.node, "--starter-focus-left", `${placement.left + (placement.width - width) / 2}px`);
    write(state, state.node, "--starter-focus-width", `${width}px`);
    write(state, state.node, "--starter-focus-max-height", `${placement.maxHeight}px`);
    // Keep the source space responsive to font/wrapping changes, without writing
    // any scroll position. Native layout clamping remains a separate observation.
    const rect = state.node.getBoundingClientRect(), style = window.getComputedStyle(state.node);
    // This sheet's normal control minima are authored in rem. Changing only a
    // control's text size must not multiply its minimum a second time.
    const rootSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    state.sourceHeight = Math.max(rect.height, state.minimumPerRem * rootSize, state.node.scrollHeight
      + (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0));
    if (state.placeholder) state.placeholder.style.height = `${state.sourceHeight}px`;
    else if (parent) write(state, parent, "padding-top", `${state.parentPadding + state.sourceHeight + state.marginHeight}px`);
    const finalPlacement = starterFocusDockPlacement(visibleBounds, state.node.getBoundingClientRect().height);
    if (finalPlacement) write(state, state.node, "--starter-focus-top", `${finalPlacement.top}px`);
  };
  return {
    isDocked: (node: HTMLElement) => docked?.node === node,
    isPressing: () => pointerId !== null,
    sourceHeight: (node: HTMLElement) => docked?.node === node ? docked.sourceHeight : node.getBoundingClientRect().height,
    pin: (node: HTMLElement) => {
      if (disposed || !dialog.open || !node.isConnected || !dialog.contains(node)
        || document.activeElement !== node) return;
      if (docked?.node === node) { position(); return; }
      // A new focus must not relocate the press target before pointerup hit-testing.
      if (pointerId !== null) return;
      // Leave third-party popovers alone. This presentation needs no popover API.
      if (node.hasAttribute("popover")) return;
      release();
      const rect = node.getBoundingClientRect(), style = window.getComputedStyle(node);
      const state: DockState = { node, placeholder: null, writes: [], sourceHeight: rect.height, sourceWidth: rect.width,
        marginHeight: (Number.parseFloat(style.marginTop) || 0) + (Number.parseFloat(style.marginBottom) || 0), parentPadding: 0,
        minimumPerRem: (Number.parseFloat(style.minHeight) || 0)
          / (Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16) };
      const parent = node.parentElement;
      if (!parent) return;
      if (node.tagName === "SUMMARY" && parent.tagName === "DETAILS") {
        // Summary must remain the native disclosure control in its own details.
        // Padding preserves its space even while the details element is closed.
        const parentStyle = window.getComputedStyle(parent);
        state.parentPadding = Number.parseFloat(parentStyle.paddingTop) || 0;
        write(state, parent, "padding-top", `${state.parentPadding + rect.height + state.marginHeight}px`);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "starter-catalog__focus-space";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = "100%";
        placeholder.style.margin = style.margin;
        placeholder.style.flex = style.flex;
        parent.insertBefore(placeholder, node);
        state.placeholder = placeholder;
      }
      docked = state;
      node.classList.add("starter-catalog__focus-docked");
      position();
    },
    refresh: () => {
      if (docked && (!dialog.open || !docked.node.isConnected || docked.node.hasAttribute("popover")
        || document.activeElement !== docked.node)) release(false);
      else { releasePending = false; position(); }
    },
    leaveFocus: (node: HTMLElement) => { if (docked?.node === node) release(false); },
    beginPointer: (id: number) => { if (!disposed && pointerId === null) pointerId = id; },
    endPointer: (id: number) => {
      if (pointerId !== id) return false;
      pointerId = null;
      // The up/cancel target is already determined. Keep the real node and parent
      // so native click dispatch/default activation does not lose its target.
      if (releasePending) release();
      return true;
    },
    release: () => { pointerId = null; release(); },
    dispose: () => { disposed = true; pointerId = null; release(); },
  };
}
