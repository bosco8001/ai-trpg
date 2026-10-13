import assert from "node:assert/strict";
import test from "node:test";
import { createStarterFocusDock, starterFocusDockMinimumHeight, starterFocusDockPlacement, starterFocusNavigationDelta, starterFocusNavigationTarget,
  starterFocusViewportBounds } from "../src/web/starter-catalog-focus-dock.js";

test("the actual control fits inside the focus-ring and simulated safe-area bounds", () => {
  const placement = starterFocusDockPlacement({ left: 0, right: 390, top: 0, bottom: 844,
    paddingTop: 47, paddingBottom: 34 }, 44);
  assert.deepEqual(placement, { left: 8, top: 766, width: 374, maxHeight: 763, fits: true });
});

test("an oversized measured box is reported as infeasible, never asserted to have shrunk", () => {
  const placement = starterFocusDockPlacement({ left: 10, right: 330, top: 20, bottom: 340,
    paddingTop: 47, paddingBottom: 34 }, 600);
  assert.deepEqual(placement, { left: 18, top: 67, width: 304, maxHeight: 239, fits: false });
  assert.ok(placement!.top + 600 > 340 - 34, "the real extent still fails containment until CSS actually shrinks it");
});

for (const bounds of [
  { left: 0, right: 16, top: 0, bottom: 100, paddingTop: 0, paddingBottom: 0 },
  { left: 0, right: 390, top: 0, bottom: 16, paddingTop: 0, paddingBottom: 0 },
  { left: NaN, right: 390, top: 0, bottom: 844, paddingTop: 0, paddingBottom: 0 },
]) test("an empty or nonfinite operation area is not assigned invented geometry", () => {
  assert.equal(starterFocusDockPlacement(bounds, 44), null);
});

// Unexecuted repair cases. DOM ownership/geometry fixture only: native details,
// hit-testing, click targets, clipping, focus, font layout, CSS owner stability and
// original-page scrollTop conservation must still be checked by the Critic.
class Style {
  values = new Map<string, { value: string; priority: string }>();
  height = ""; width = ""; margin = ""; flex = "";
  getPropertyValue(key: string) { return this.values.get(key)?.value ?? ""; }
  getPropertyPriority(key: string) { return this.values.get(key)?.priority ?? ""; }
  setProperty(key: string, value: string, priority = "") {
    // Exercise the CSSOM serialization mismatch missed by the old string Map.
    const serialized = key === "padding-top" && value.endsWith("px")
      ? `${Number(Number.parseFloat(value).toFixed(4))}px` : value;
    this.values.set(key, { value: serialized, priority });
  }
  removeProperty(key: string) { const previous = this.getPropertyValue(key); this.values.delete(key); return previous; }
}
class Node {
  style = new Style(); classes = new Set<string>(); attributes = new Map<string, string>();
  className = ""; isConnected = true; parentElement: Node | null = null; children: Node[] = [];
  popoverOpen = false; showCalls = 0; focusCalls: unknown[] = [];
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  rect = { left: 0, right: 390, top: 0, bottom: 44, width: 390, height: 44 };
  scrollTop = 300;
  scrollHeight = 44;
  constructor(public tagName = "BUTTON") {}
  getBoundingClientRect() { return this.rect; }
  querySelectorAll(): Node[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); }
  closest(tag: string): Node | null { return this.tagName === tag.toUpperCase() ? this : this.parentElement?.closest(tag) ?? null; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  hasAttribute(key: string) { return this.attributes.has(key); }
  removeAttribute(key: string) { this.attributes.delete(key); if (key === "popover") this.popoverOpen = false; }
  showPopover() { this.showCalls++; this.popoverOpen = true; }
  matches(selector: string) { return selector === ":popover-open" && this.popoverOpen; }
  focus(options: unknown) { this.focusCalls.push(options); }
  insertBefore(node: Node, before: Node) {
    this.children.splice(this.children.indexOf(before), 0, node); node.parentElement = this;
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
    this.parentElement = null; this.isConnected = false;
  }
  contains(node: Node): boolean { return node === this || this.children.some(child => child.contains(node)); }
}
function fixture(run: (f: ReturnType<typeof createFixture>) => void) {
  const f = createFixture();
  const originals = ["window", "document"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: f.window }, document: { configurable: true, value: f.document },
  });
  try { run(f); }
  finally {
    f.dock.dispose();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
function createFixture() {
  const dialog = Object.assign(new Node("DIALOG"), { open: true,
    querySelector: (selector: string) => selector === ".starter-catalog__focus-rail" ? rail : frame });
  dialog.rect = { left: 0, right: 390, top: 0, bottom: 844, width: 390, height: 844 };
  const frame = new Node("DIV"), parent = new Node("FOOTER"), control = new Node();
  const rail = new Node("DIV");
  frame.rect = { left: 0, right: 390, top: 0, bottom: 700, width: 390, height: 700 };
  rail.rect = { left: 0, right: 390, top: 700, bottom: 844, width: 390, height: 144 };
  dialog.children = [frame, rail]; frame.parentElement = dialog; rail.parentElement = dialog;
  frame.children = [parent]; parent.parentElement = frame;
  parent.children = [control]; control.parentElement = parent;
  const document = { activeElement: control, documentElement: new Node("HTML"), createElement: () => new Node("SPAN") };
  const window = { innerWidth: 390, innerHeight: 844, visualViewport: undefined,
    getComputedStyle: (node: Node) => ({ margin: "0px", marginTop: "0px", marginBottom: "0px", flex: "0 1 auto",
      getPropertyValue: (key: string) => node.style.getPropertyValue(key),
      fontSize: node.style.getPropertyValue("font-size") || "16px", lineHeight: node.style.getPropertyValue("line-height") || "24.8px",
      minHeight: node.style.getPropertyValue("min-height") || "44px",
      scrollPaddingTop: node.style.getPropertyValue("scroll-padding-top") || "8px",
      scrollPaddingBottom: node.style.getPropertyValue("scroll-padding-bottom") || "34px",
      paddingBottom: node === rail ? "34px" : "0px", paddingLeft: "0px", paddingRight: "0px",
      borderLeftWidth: "0px", borderRightWidth: "0px", borderTopWidth: "0px", borderBottomWidth: "0px",
      paddingTop: node.style.getPropertyValue("padding-top") || "0px" }) };
  const dock = createStarterFocusDock(dialog as unknown as HTMLDialogElement);
  return { dialog, frame, rail, parent, control, document, window, dock,
    pin: () => dock.pin(control as unknown as HTMLElement) };
}

test("docking keeps the same active node and parent, and does not write either scroll position", () => fixture(f => {
  const before = f.document.activeElement;
  f.pin(); f.dock.refresh();
  assert.equal(f.document.activeElement, before);
  assert.equal(f.control.parentElement, f.parent);
  assert.equal(f.parent.children.filter(node => node === f.control).length, 1);
  assert.equal(f.frame.scrollTop, 300); assert.equal(f.parent.scrollTop, 300);
  assert.equal(f.control.classes.has("starter-catalog__focus-docked"), true);
  assert.equal(f.control.getAttribute("popover"), null);
  assert.equal(f.control.popoverOpen, false);
  assert.equal(f.control.showCalls, 0);
  const placeholder = f.parent.children.find(node => node !== f.control);
  assert.equal(placeholder?.attributes.get("aria-hidden"), "true");
  f.dock.release();
  assert.deepEqual(f.parent.children, [f.control]);
  assert.equal(f.document.activeElement, before);
  assert.equal(f.control.classes.has("starter-catalog__focus-docked"), false);
  assert.equal(f.control.getAttribute("popover"), null);
  assert.equal(f.control.popoverOpen, false);
  assert.deepEqual(f.control.focusCalls, []);
}));

test("a summary stays in its original details and its source space is not accumulated", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.parent.style.setProperty("padding-top", "4px");
  f.pin();
  for (let i = 0; i < 5; i++) { f.pin(); f.dock.refresh(); }
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "48px");
  assert.deepEqual(f.parent.children, [f.control]);
  assert.equal(f.control.parentElement, f.parent);
  f.dock.release();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "4px");
}));

test("release restores owned styles while keeping a later third-party override", () => fixture(f => {
  f.control.style.setProperty("--starter-focus-left", "21px", "important");
  f.pin();
  f.control.style.setProperty("--starter-focus-top", "99px", "important");
  f.dock.release();
  assert.equal(f.control.style.getPropertyValue("--starter-focus-left"), "21px");
  assert.equal(f.control.style.getPropertyPriority("--starter-focus-left"), "important");
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "99px");
  assert.equal(f.control.style.getPropertyPriority("--starter-focus-top"), "important");
}));

test("an existing third-party popover is not commandeered or hidden", () => fixture(f => {
  f.control.setAttribute("popover", "auto"); f.control.popoverOpen = true;
  f.pin(); f.dock.dispose();
  assert.equal(f.control.getAttribute("popover"), "auto");
  assert.equal(f.control.popoverOpen, true);
  assert.equal(f.control.showCalls, 0);
  assert.deepEqual(f.parent.children, [f.control]);
}));

test("a later third-party popover takes its own presentation without losing its attribute or focus", () => fixture(f => {
  f.pin();
  f.control.setAttribute("popover", "auto"); f.control.popoverOpen = true;
  f.dock.refresh();
  assert.equal(f.control.getAttribute("popover"), "auto");
  assert.equal(f.control.popoverOpen, true);
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.equal(f.document.activeElement, f.control);
  assert.deepEqual(f.parent.children, [f.control]);
  assert.deepEqual(f.control.focusCalls, []);
}));

// Popover-specific rollback expectations are superseded by the confirmed CSS
// reserve design. The corresponding environments must still preserve focus and
// clean source space; no required user behavior is skipped or relaxed.
for (const capability of ["missing", "cancelled", "throwing"] as const)
test(`a ${capability} showPopover does not block the actual focus or leave source space`, () => fixture(f => {
  Object.defineProperty(f.control, "showPopover", { configurable: true,
    value: capability === "missing" ? undefined : () => {
      if (capability === "throwing") throw new Error("native show unavailable");
    } });
  const before = f.document.activeElement;
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.parent.style.setProperty("padding-top", "4px");
  f.pin(); f.dock.refresh();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.document.activeElement, before);
  assert.equal(f.control.parentElement, f.parent);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "48px");
  assert.equal(f.control.showCalls, 0);
  f.dock.release();
  assert.equal(f.control.getAttribute("popover"), null);
  assert.equal(f.control.classes.has("starter-catalog__focus-docked"), false);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "4px");
  assert.deepEqual(f.parent.children, [f.control]);
  assert.deepEqual(f.control.focusCalls, []);
  assert.equal(f.frame.scrollTop, 300);
}));

test("fractional source padding restores the original serialized value and priority", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.control.rect.height = 49.796875; f.control.scrollHeight = 49.796875;
  f.parent.style.setProperty("padding-top", "0px", "important");
  f.pin();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "49.7969px");
  f.dock.release();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "0px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "important");
  assert.equal(f.control.getAttribute("popover"), null);
  assert.equal(f.control.parentElement, f.parent);
}));

test("a later override of summary padding is preserved without stealing focus", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.pin();
  f.parent.style.setProperty("padding-top", "90px", "important");
  const body = new Node("BODY"); f.document.activeElement = body;
  f.dock.release();
  assert.equal(f.document.activeElement, body);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "90px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "important");
  assert.deepEqual(f.control.focusCalls, []);
  assert.equal(f.frame.scrollTop, 300);
}));

// t77u 補修案例尚未執行。鎖住外部寫入→refresh→release／repin 的真實 helper 鏈；
// fixture 不會模擬原生 details、CSS 空間分配或來源縮短後的 scroll clamp。
for (const external of [
  { name: "value", value: "12px", priority: "" },
  { name: "value and priority", value: "12px", priority: "important" },
  { name: "priority only", value: "49px", priority: "important" },
  { name: "removal", value: "", priority: "" },
]) test(`refresh cedes summary padding after an external ${external.name} change`, () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.parent.style.setProperty("padding-top", "5px"); f.pin();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "49px");
  if (external.value) f.parent.style.setProperty("padding-top", external.value, external.priority);
  else f.parent.style.removeProperty("padding-top");
  for (let i = 0; i < 3; i++) {
    f.dock.refresh();
    assert.equal(f.parent.style.getPropertyValue("padding-top"), external.value);
    assert.equal(f.parent.style.getPropertyPriority("padding-top"), external.priority);
  }
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.document.activeElement, f.control);
  assert.equal(f.control.parentElement, f.parent);
  assert.equal(f.frame.scrollTop, 300);
  f.dock.release();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), external.value);
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), external.priority);
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "");
  assert.deepEqual(f.control.focusCalls, []);
}));

test("an observed external owner keeps padding even after writing the former dock value again", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.parent.style.setProperty("padding-top", "5px"); f.pin();
  const dockValue = f.parent.style.getPropertyValue("padding-top");
  f.parent.style.setProperty("padding-top", "12px"); f.dock.refresh();
  f.parent.style.setProperty("padding-top", dockValue);
  f.control.rect.height = 88; f.control.scrollHeight = 120;
  f.dock.refresh(); f.dock.release();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), dockValue);
  assert.notEqual(dockValue, "5px");
  assert.equal(f.frame.scrollTop, 300);
}));

test("an insufficient rail, then automatic close release and repin, cannot reclaim external padding", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.parent.style.setProperty("padding-top", "5px"); f.pin();
  f.parent.style.setProperty("padding-top", "12px", "important");
  // t78 A keeps the actual focus when geometry is insufficient; it does not
  // pretend the sub-44px capacity contains this box. Close still auto-releases.
  f.rail.rect.top = 790; f.rail.rect.height = 54; f.dock.refresh();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.dock.geometry(f.control as unknown as HTMLElement)?.fits, false);
  f.dialog.open = false; f.dock.refresh();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  f.dialog.open = true;
  f.rail.rect.top = 700; f.rail.rect.height = 144; f.pin(); f.dock.refresh();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "important");
  f.dock.release(); f.pin(); f.dock.dispose();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "important");
  assert.equal(f.document.activeElement, f.control);
  assert.equal(f.control.parentElement, f.parent);
  assert.deepEqual(f.control.focusCalls, []);
  assert.equal(f.frame.scrollTop, 300);
}));

test("release observes an external owner before any refresh and later repin preserves it", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.pin(); f.parent.style.setProperty("padding-top", "12px");
  f.dock.release(); f.pin(); f.dock.refresh(); f.dock.release();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "");
}));

test("root and source-height changes do not rewrite padding ceded to an external owner", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.pin(); f.parent.style.setProperty("padding-top", "12px", "important"); f.dock.refresh();
  f.document.documentElement.style.setProperty("font-size", "32px");
  f.control.rect.height = 88; f.control.scrollHeight = 120;
  f.dock.refresh();
  assert.equal(f.dock.sourceHeight(f.control as unknown as HTMLElement), 120);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  f.parent.style.setProperty("padding-top", "18px"); f.dock.refresh(); f.dock.release();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "18px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "");
  assert.equal(f.frame.scrollTop, 300);
}));

test("ceding one inline property leaves other owned geometry responsive and restorable", () => fixture(f => {
  f.control.style.setProperty("--starter-focus-left", "21px", "important"); f.pin();
  f.control.style.setProperty("--starter-focus-top", "99px", "important");
  f.rail.rect.bottom = 800; f.dock.refresh();
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "99px");
  assert.equal(f.control.style.getPropertyPriority("--starter-focus-top"), "important");
  assert.equal(f.control.style.getPropertyValue("--starter-focus-max-height"), "50px");
  f.dock.release();
  assert.equal(f.control.style.getPropertyValue("--starter-focus-left"), "21px");
  assert.equal(f.control.style.getPropertyPriority("--starter-focus-left"), "important");
  assert.equal(f.control.style.getPropertyValue("--starter-focus-max-height"), "");
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "99px");
}));

test("a pending pointer release preserves a later padding owner and does not refocus", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.pin(); f.dock.beginPointer(7);
  f.parent.style.setProperty("padding-top", "12px", "important");
  const next = new Node("SUMMARY"); f.document.activeElement = next;
  f.dock.refresh(); f.dock.leaveFocus(f.control as unknown as HTMLElement);
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  assert.equal(f.dock.endPointer(7), true); f.dock.refresh(); f.dock.dispose();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "important");
  assert.equal(f.document.activeElement, next);
  assert.deepEqual(f.control.focusCalls, []);
  assert.equal(f.frame.scrollTop, 300);
}));

test("dispose retains unobserved external padding and late work cannot reclaim it", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.pin(); f.parent.style.setProperty("padding-top", "12px", "important");
  f.dock.dispose(); f.dock.refresh(); f.pin();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "12px");
  assert.equal(f.parent.style.getPropertyPriority("padding-top"), "important");
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "");
  assert.equal(f.control.parentElement, f.parent);
  assert.equal(f.frame.scrollTop, 300);
}));

test("focus transfer releases the old control without focusing a replacement", () => fixture(f => {
  f.pin(); const next = new Node(); f.document.activeElement = next;
  f.dock.refresh();
  assert.equal(f.document.activeElement, next);
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.deepEqual(f.parent.children, [f.control]);
}));

test("dispose restores the control and a late refresh or pin cannot recreate its layer", () => fixture(f => {
  f.pin(); f.dock.dispose(); f.dock.refresh(); f.pin();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.deepEqual(f.parent.children, [f.control]);
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "");
}));

test("the reserve geometry is outside the scroll frame and deducts safe area and focus outline", () => fixture(f => {
  f.pin();
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "758px");
  assert.equal(f.control.style.getPropertyValue("--starter-focus-max-height"), "94px");
  const top = Number.parseFloat(f.control.style.getPropertyValue("--starter-focus-top"));
  assert.ok(top >= f.frame.rect.bottom + 8);
  assert.ok(top + f.control.rect.height <= f.rail.rect.bottom - 34 - 8);
  assert.equal(f.frame.scrollTop, 300);
  assert.equal(f.rail.scrollTop, 300);
}));

test("insufficient capacity keeps the actual focus and records a failed fit without inventing space", () => fixture(f => {
  f.rail.rect.top = 790; f.rail.rect.height = 54;
  f.pin();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.dock.geometry(f.control as unknown as HTMLElement)?.fits, false);
  assert.equal(f.document.activeElement, f.control);
  assert.equal(f.control.parentElement, f.parent);
  assert.deepEqual(f.control.focusCalls, []);
  assert.equal(f.frame.scrollTop, 300);
}));

// t78 A 新案例尚未執行。只驗尺寸輸入／讀回契約；fixture 不實作 CSS 排版。
for (const viewportBottom of [160, 195])
test(`t78 V1 ${viewportBottom}px: a measured 58px box is not positioned as a fictional 44px box`, () => {
  const bounds = { left: 0, right: 284, top: viewportBottom - 60, bottom: viewportBottom,
    paddingTop: 8, paddingBottom: 8 };
  const tooTall = starterFocusDockPlacement(bounds, 58)!;
  assert.equal(tooTall.maxHeight, 44);
  assert.equal(tooTall.fits, false);
  assert.equal(tooTall.top, bounds.top + 8);
  assert.ok(tooTall.top + 58 > viewportBottom - 8);
  const measuredAfterCompact = starterFocusDockPlacement(bounds, 44)!;
  assert.equal(measuredAfterCompact.fits, true);
  assert.equal(measuredAfterCompact.top + 44, viewportBottom - 8);
});

test("the compact budget includes a larger descendant line and preserves the font across dock state", () => fixture(f => {
  const label = new Node("STRONG"); label.parentElement = f.control; f.control.children.push(label);
  label.style.setProperty("font-size", "36px"); label.style.setProperty("line-height", "55.8px");
  const node = f.control as unknown as HTMLElement;
  const before = starterFocusDockMinimumHeight(node);
  assert.equal(before, 63.8); // This fixture has no border; real CSS adds its measured borders.
  f.pin();
  assert.equal(starterFocusDockMinimumHeight(node), before);
  assert.equal(f.control.style.getPropertyValue("--starter-focus-min-height"), "63.8px");
  assert.equal(label.style.getPropertyValue("font-size"), "36px");
  f.dock.release();
  assert.equal(starterFocusDockMinimumHeight(node), before);
  assert.equal(f.control.style.getPropertyValue("--starter-focus-min-height"), "");
}));

test("the sheet's compact padding participates in the budget without changing source padding", () => fixture(f => {
  f.dialog.style.setProperty("--starter-focus-padding-block", "12px");
  f.control.style.setProperty("line-height", "55px");
  f.control.style.setProperty("padding-top", "28px");
  assert.equal(starterFocusDockMinimumHeight(f.control as unknown as HTMLElement), 79);
  f.pin();
  assert.equal(f.control.style.getPropertyValue("padding-top"), "28px");
  assert.equal(f.control.style.getPropertyValue("--starter-focus-min-height"), "79px");
  f.dock.release();
  assert.equal(f.control.style.getPropertyValue("padding-top"), "28px");
}));

test("position reads the unchanged actual box after CSS writes and retains an explicit failed fit", () => fixture(f => {
  // Deliberately do not make a style write shrink the fixture's rect.
  f.control.rect.height = 120; f.control.scrollHeight = 120;
  f.pin();
  assert.deepEqual(f.dock.geometry(f.control as unknown as HTMLElement), { actualHeight: 120, availableHeight: 94, fits: false });
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "708px");
  assert.equal(f.frame.scrollTop, 300);
  f.control.rect.height = 44; f.dock.refresh();
  assert.deepEqual(f.dock.geometry(f.control as unknown as HTMLElement), { actualHeight: 44, availableHeight: 94, fits: true });
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), "758px");
}));

test("an external min-height owner is retained on refresh and release", () => fixture(f => {
  f.pin();
  f.control.style.setProperty("--starter-focus-min-height", "90px", "important");
  f.dock.refresh(); f.dock.release();
  assert.equal(f.control.style.getPropertyValue("--starter-focus-min-height"), "90px");
  assert.equal(f.control.style.getPropertyPriority("--starter-focus-min-height"), "important");
}));

test("source space follows the real control's font and content height without accumulating padding", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.parent.style.setProperty("padding-top", "4px");
  f.pin();
  f.control.style.setProperty("font-size", "32px");
  f.control.rect.height = 88; f.control.scrollHeight = 120;
  f.dock.refresh(); f.dock.refresh();
  assert.equal(f.dock.sourceHeight(f.control as unknown as HTMLElement), 120);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "124px");
  assert.equal(f.frame.scrollTop, 300);
  f.dock.release();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "4px");
}));

test("normal rem minimum follows root size without treating a text-only change as another multiplier", () => fixture(f => {
  f.control.style.setProperty("min-height", "84px"); f.control.rect.height = 84;
  f.pin();
  f.control.rect.height = 44; f.control.style.setProperty("font-size", "32px");
  f.dock.refresh();
  assert.equal(f.dock.sourceHeight(f.control as unknown as HTMLElement), 84);
  f.document.documentElement.style.setProperty("font-size", "32px"); f.dock.refresh();
  assert.equal(f.dock.sourceHeight(f.control as unknown as HTMLElement), 168);
  assert.equal(f.frame.scrollTop, 300);
}));

for (const end of ["up", "cancel"] as const)
test(`focus transfer retains source geometry until pointer${end} and then restores it`, () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.control.rect.height = 49.796875; f.control.scrollHeight = 49.796875;
  f.parent.style.setProperty("padding-top", "4px"); f.pin();
  const before = f.parent.style.getPropertyValue("padding-top");
  const top = f.control.style.getPropertyValue("--starter-focus-top");
  f.dock.beginPointer(7);
  assert.equal(f.dock.isPressing(), true);
  const next = new Node("SUMMARY"); f.document.activeElement = next;
  f.dock.refresh(); f.dock.leaveFocus(f.control as unknown as HTMLElement);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), before);
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), top);
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.dock.endPointer(8), false); // Another pointer cannot settle this operation.
  assert.equal(f.parent.style.getPropertyValue("padding-top"), before);
  assert.equal(f.dock.isPressing(), true);
  assert.equal(f.dock.endPointer(7), true); f.dock.refresh();
  assert.equal(f.dock.isPressing(), false);
  assert.equal(f.document.activeElement, next);
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "4px");
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.deepEqual(f.control.focusCalls, []);
  assert.equal(f.frame.scrollTop, 300);
}));

test("reflow during a press cannot move the existing target or replace it with the new focus", () => fixture(f => {
  f.pin(); f.dock.beginPointer(3);
  const top = f.control.style.getPropertyValue("--starter-focus-top");
  f.rail.rect.top = 500; f.rail.rect.bottom = 700;
  f.dock.refresh(); f.pin();
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), top);
  const next = new Node(); next.parentElement = f.parent; f.parent.children.push(next);
  f.document.activeElement = next;
  f.dock.refresh(); f.dock.pin(next as unknown as HTMLElement);
  assert.equal(f.dock.isDocked(next as unknown as HTMLElement), false);
  assert.equal(f.control.style.getPropertyValue("--starter-focus-top"), top);
  f.dock.endPointer(3);
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.deepEqual(f.parent.children, [f.control, next]);
  assert.equal(f.frame.scrollTop, 300);
}));

test("an actual blur cleans source space even before activeElement changes, without refocusing BODY", () => fixture(f => {
  f.pin();
  f.dock.leaveFocus(f.control as unknown as HTMLElement);
  f.document.activeElement = new Node("BODY");
  f.dock.refresh();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.deepEqual(f.parent.children, [f.control]);
  assert.deepEqual(f.control.focusCalls, []);
  assert.equal(f.document.activeElement.tagName, "BODY");
}));

test("navigation or close settles a pending press and late pointer events cannot recreate the dock", () => fixture(f => {
  f.pin(); f.dock.beginPointer(9); f.dock.leaveFocus(f.control as unknown as HTMLElement);
  f.dock.release();
  assert.deepEqual(f.parent.children, [f.control]);
  f.dock.endPointer(9); f.dock.refresh();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  f.pin(); f.dock.beginPointer(10); f.dock.dispose(); f.dock.endPointer(10); f.pin();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.deepEqual(f.parent.children, [f.control]);
}));

test("return navigation uses the same scroll-padding bounds as focus observation", () => fixture(f => {
  f.frame.style.setProperty("scroll-padding-top", "16px");
  f.frame.style.setProperty("scroll-padding-bottom", "24px");
  const bounds = starterFocusViewportBounds(f.frame as unknown as HTMLElement);
  assert.deepEqual(bounds, { left: 0, right: 390, top: 16, bottom: 676 });
  const row = { left: 0, right: 390, top: 640, bottom: 724 };
  const delta = starterFocusNavigationDelta(row, bounds);
  assert.equal(delta, 48);
  assert.equal(starterFocusNavigationDelta({ ...row, top: row.top - delta, bottom: row.bottom - delta }, bounds), 0);
  assert.equal(starterFocusNavigationDelta({ ...row, top: 0, bottom: 84 }, bounds), -16);
  assert.equal(starterFocusNavigationDelta({ ...row, top: 40, bottom: 900 }, bounds), 24);
}));

test("navigation shares visual-viewport clipping with focus measurement", () => fixture(f => {
  Object.defineProperty(f.window, "visualViewport", { configurable: true,
    value: { offsetLeft: 10, offsetTop: 100, width: 320, height: 400 } });
  const bounds = starterFocusViewportBounds(f.frame as unknown as HTMLElement);
  assert.deepEqual(bounds, { left: 10, right: 330, top: 108, bottom: 466 });
  assert.equal(starterFocusNavigationDelta({ left: 10, right: 330, top: 440, bottom: 484 }, bounds), 18);
}));

// 尚未執行。This local setter model exercises write/read geometry, not native
// browser layout, the Panel lifecycle or RO/rAF. The real-page probe covers those.
function navigationSample(control: Parameters<typeof starterFocusNavigationTarget>[0],
  viewport: Parameters<typeof starterFocusNavigationTarget>[1], current = 0, maximum = 1200,
  quantize: (value: number) => number = Math.floor) {
  let position = current;
  const writes: number[] = [];
  const rect = () => ({ ...control, top: control.top - (position - current), bottom: control.bottom - (position - current) });
  return {
    viewport, maximum, writes, rect,
    get scrollTop() { return position; },
    set scrollTop(value: number) { writes.push(value); position = Math.min(maximum, Math.max(0, quantize(value))); },
    contained: () => {
      const actual = rect();
      return actual.top >= viewport.top && actual.bottom <= viewport.bottom
        && actual.left >= viewport.left && actual.right <= viewport.right;
    },
  };
}

for (const sample of [
  { name: "844x390", bottom: 273, rowBottom: 520.484375, target: 248 },
  { name: "568x320", bottom: 203, rowBottom: 520.484375, target: 318 },
  { name: "390x620", bottom: 503, rowBottom: 604.234375, target: 102 },
]) test(`G4 ${sample.name}: actual setter readback contains the row after one navigation write`, () => {
  // t76u supplied the residual and bottom edges; the rest is isolated model geometry.
  const viewport = { left: 0, right: 390, top: 16, bottom: sample.bottom };
  const control = { left: 0, right: 390, top: sample.rowBottom - 84, bottom: sample.rowBottom };
  const before = navigationSample(control, viewport);
  before.scrollTop += starterFocusNavigationDelta(before.rect(), viewport);
  assert.equal(before.contained(), false, "the old fractional edge write must remain a red control in this model");
  const after = navigationSample(control, viewport);
  after.scrollTop = starterFocusNavigationTarget(after.rect(), viewport, after.scrollTop, after.maximum);
  assert.deepEqual(after.writes, [sample.target]);
  assert.equal(after.scrollTop, sample.target);
  assert.equal(after.contained(), true, "compare the actual post-setter rect with both unchanged edges");
});

test("top-edge navigation rounds the absolute position inward, rather than rounding a delta", () => {
  const viewport = { left: 0, right: 390, top: 16, bottom: 273 };
  const sample = navigationSample({ left: 0, right: 390, top: 15.75, bottom: 99.75 }, viewport, 300.5);
  sample.scrollTop = starterFocusNavigationTarget(sample.rect(), viewport, sample.scrollTop, sample.maximum);
  assert.deepEqual(sample.writes, [300]);
  assert.equal(sample.contained(), true);
});

test("an already-contained fractional position is not rounded or given an extra write", () => {
  const viewport = { left: 0, right: 390, top: 16, bottom: 273 };
  const sample = navigationSample({ left: 0, right: 390, top: 16, bottom: 100 }, viewport, 300.375);
  const target = starterFocusNavigationTarget(sample.rect(), viewport, sample.scrollTop, sample.maximum);
  if (target !== sample.scrollTop) sample.scrollTop = target;
  assert.equal(target, 300.375);
  assert.deepEqual(sample.writes, []);
  assert.equal(sample.contained(), true);
});

test("a fractional-only feasible interval never rounds through the opposite edge", () => {
  const viewport = { left: 0, right: 390, top: 16, bottom: 100 };
  const control = { left: 0, right: 390, top: 116.75, bottom: 200.25 };
  const fractional = navigationSample(control, viewport, 0, 1200, value => value);
  fractional.scrollTop = starterFocusNavigationTarget(fractional.rect(), viewport, fractional.scrollTop, fractional.maximum);
  assert.deepEqual(fractional.writes, [100.25]);
  assert.equal(fractional.contained(), true);
  const integer = navigationSample(control, viewport);
  integer.scrollTop = starterFocusNavigationTarget(integer.rect(), viewport, integer.scrollTop, integer.maximum);
  assert.deepEqual(integer.writes, [100.25]);
  assert.equal(integer.contained(), false, "an unrepresentable interval must not be reported as contained");
});

test("a range clamp is explicit and cannot invent extra scroll room", () => {
  const viewport = { left: 0, right: 390, top: 16, bottom: 100 };
  const sample = navigationSample({ left: 0, right: 390, top: 116.5, bottom: 200.5 }, viewport, 0, 100.25, value => value);
  sample.scrollTop = starterFocusNavigationTarget(sample.rect(), viewport, sample.scrollTop, sample.maximum);
  assert.deepEqual(sample.writes, [100.25]);
  assert.equal(sample.contained(), false);
  assert.equal(starterFocusNavigationTarget(sample.rect(), viewport, sample.scrollTop, sample.maximum), 100.25);
});

test("oversized rows retain their start-alignment policy without claiming full containment", () => {
  const viewport = { left: 0, right: 390, top: 16, bottom: 676 };
  const sample = navigationSample({ left: 0, right: 390, top: 40, bottom: 900 }, viewport);
  sample.scrollTop = starterFocusNavigationTarget(sample.rect(), viewport, sample.scrollTop, sample.maximum);
  assert.deepEqual(sample.writes, [24]);
  assert.equal(sample.rect().top, viewport.top);
  assert.equal(sample.contained(), false);
});

test("a deferred new dock can be applied after a matching press ends without granting scroll movement", () => fixture(f => {
  f.dock.beginPointer(12); f.pin();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.deepEqual(f.parent.children, [f.control]);
  f.dock.endPointer(12); f.pin();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), true);
  assert.equal(f.document.activeElement, f.control);
  assert.equal(f.frame.scrollTop, 300);
  assert.deepEqual(f.control.focusCalls, []);
}));
