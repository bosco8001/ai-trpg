type Rect = { left: number; right: number; top: number; bottom: number };
type DockBounds = Rect & { paddingTop: number; paddingBottom: number };

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
  type StyleWrite = { node: HTMLElement; key: string; previous: string; priority: string; value: string };
  type DockState = { node: HTMLElement; placeholder: HTMLElement | null; writes: StyleWrite[] };
  let docked: DockState | null = null;
  let disposed = false;
  const write = (state: DockState, node: HTMLElement, key: string, value: string) => {
    let saved = state.writes.find(item => item.node === node && item.key === key);
    if (!saved) {
      saved = { node, key, previous: node.style.getPropertyValue(key),
        priority: node.style.getPropertyPriority(key), value };
      state.writes.push(saved);
    }
    saved.value = value;
    node.style.setProperty(key, value);
  };
  const release = () => {
    const state = docked;
    if (!state) return;
    const wasFocused = document.activeElement === state.node;
    docked = null;
    // Removing our manual popover also releases its top-layer box. Do not alter
    // a later third-party popover setting or restore focus after an actual blur.
    if (state.node.getAttribute("popover") === "manual") state.node.removeAttribute("popover");
    state.node.classList.remove("starter-catalog__focus-docked");
    state.placeholder?.remove();
    for (const item of state.writes.reverse()) {
      // Leave a later third-party inline override intact.
      if (item.node.style.getPropertyValue(item.key) !== item.value
        || item.node.style.getPropertyPriority(item.key)) continue;
      if (item.previous) item.node.style.setProperty(item.key, item.previous, item.priority);
      else item.node.style.removeProperty(item.key);
    }
    if (wasFocused && state.node.isConnected && dialog.open && document.activeElement !== state.node)
      state.node.focus({ preventScroll: true });
  };
  const position = () => {
    const state = docked;
    if (!state || disposed) return;
    const bounds = dialog.getBoundingClientRect();
    const frame = dialog.querySelector<HTMLElement>(".class-catalog__frame");
    if (!frame) { release(); return; }
    const padding = window.getComputedStyle(frame);
    const viewport = window.visualViewport;
    const visibleBounds = {
      left: Math.max(bounds.left, viewport?.offsetLeft ?? 0),
      right: Math.min(bounds.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth)),
      top: Math.max(bounds.top, viewport?.offsetTop ?? 0),
      bottom: Math.min(bounds.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)),
      paddingTop: Number.parseFloat(padding.scrollPaddingTop) || 0,
      paddingBottom: Number.parseFloat(padding.scrollPaddingBottom) || 0,
    };
    const placement = starterFocusDockPlacement(visibleBounds, state.node.getBoundingClientRect().height);
    if (!placement) { release(); return; }
    write(state, state.node, "--starter-focus-left", `${placement.left}px`);
    write(state, state.node, "--starter-focus-width", `${placement.width}px`);
    write(state, state.node, "--starter-focus-max-height", `${placement.maxHeight}px`);
    // Width can change wrapping. Measure the real control once after that write.
    const finalPlacement = starterFocusDockPlacement(visibleBounds, state.node.getBoundingClientRect().height);
    if (finalPlacement) write(state, state.node, "--starter-focus-top", `${finalPlacement.top}px`);
  };
  return {
    isDocked: (node: HTMLElement) => docked?.node === node,
    pin: (node: HTMLElement) => {
      if (disposed || !dialog.open || !node.isConnected || !dialog.contains(node)
        || document.activeElement !== node) return;
      if (docked?.node === node) { position(); return; }
      // A native top-layer box escapes the existing container-query containment
      // and clipping without reparenting the original control or changing layout.
      if (typeof node.showPopover !== "function" || node.hasAttribute("popover")) return;
      release();
      const rect = node.getBoundingClientRect(), style = window.getComputedStyle(node);
      const state: DockState = { node, placeholder: null, writes: [] };
      const parent = node.parentElement;
      if (!parent) return;
      if (node.tagName === "SUMMARY" && parent.tagName === "DETAILS") {
        // Summary must remain the native disclosure control in its own details.
        // Padding preserves its space even while the details element is closed.
        const parentStyle = window.getComputedStyle(parent);
        const space = rect.height + (Number.parseFloat(style.marginTop) || 0) + (Number.parseFloat(style.marginBottom) || 0);
        write(state, parent, "padding-top", `${(Number.parseFloat(parentStyle.paddingTop) || 0) + space}px`);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "starter-catalog__focus-space";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        placeholder.style.margin = style.margin;
        placeholder.style.flex = style.flex;
        parent.insertBefore(placeholder, node);
        state.placeholder = placeholder;
      }
      docked = state;
      node.classList.add("starter-catalog__focus-docked");
      node.setAttribute("popover", "manual");
      try { node.showPopover(); }
      catch { release(); return; }
      if (!node.matches(":popover-open")) { release(); return; }
      if (document.activeElement !== node) node.focus({ preventScroll: true });
      position();
    },
    refresh: () => {
      if (docked && (!docked.node.isConnected || document.activeElement !== docked.node
        || !docked.node.matches(":popover-open"))) release();
      else position();
    },
    release,
    dispose: () => { disposed = true; release(); },
  };
}
