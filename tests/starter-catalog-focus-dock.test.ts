import assert from "node:assert/strict";
import test from "node:test";
import { createStarterFocusDock, starterFocusDockPlacement } from "../src/web/starter-catalog-focus-dock.js";

test("the actual control fits inside the focus-ring and simulated safe-area bounds", () => {
  const placement = starterFocusDockPlacement({ left: 0, right: 390, top: 0, bottom: 844,
    paddingTop: 47, paddingBottom: 34 }, 44);
  assert.deepEqual(placement, { left: 8, top: 766, width: 374, maxHeight: 763 });
});

test("an oversized control uses the available operation area instead of extending outside it", () => {
  const placement = starterFocusDockPlacement({ left: 10, right: 330, top: 20, bottom: 340,
    paddingTop: 47, paddingBottom: 34 }, 600);
  assert.deepEqual(placement, { left: 18, top: 67, width: 304, maxHeight: 239 });
});

for (const bounds of [
  { left: 0, right: 16, top: 0, bottom: 100, paddingTop: 0, paddingBottom: 0 },
  { left: 0, right: 390, top: 0, bottom: 16, paddingTop: 0, paddingBottom: 0 },
  { left: NaN, right: 390, top: 0, bottom: 844, paddingTop: 0, paddingBottom: 0 },
]) test("an empty or nonfinite operation area is not assigned invented geometry", () => {
  assert.equal(starterFocusDockPlacement(bounds, 44), null);
});

// DOM ownership fixture only: native details, clipping, focus, font layout and
// original-page scrollTop conservation must still be checked by the Critic.
class Style {
  values = new Map<string, { value: string; priority: string }>();
  height = ""; width = ""; margin = ""; flex = "";
  getPropertyValue(key: string) { return this.values.get(key)?.value ?? ""; }
  getPropertyPriority(key: string) { return this.values.get(key)?.priority ?? ""; }
  setProperty(key: string, value: string, priority = "") { this.values.set(key, { value, priority }); }
  removeProperty(key: string) { const previous = this.getPropertyValue(key); this.values.delete(key); return previous; }
}
class Node {
  style = new Style(); classes = new Set<string>(); attributes = new Map<string, string>();
  className = ""; isConnected = true; parentElement: Node | null = null; children: Node[] = [];
  popoverOpen = false; showCalls = 0; focusCalls: unknown[] = [];
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  rect = { left: 0, right: 390, top: 0, bottom: 44, width: 390, height: 44 };
  scrollTop = 300;
  constructor(public tagName = "BUTTON") {}
  getBoundingClientRect() { return this.rect; }
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
  const dialog = Object.assign(new Node("DIALOG"), { open: true, querySelector: () => frame });
  dialog.rect = { left: 0, right: 390, top: 0, bottom: 844, width: 390, height: 844 };
  const frame = new Node("DIV"), parent = new Node("FOOTER"), control = new Node();
  dialog.children = [frame]; frame.parentElement = dialog;
  frame.children = [parent]; parent.parentElement = frame;
  parent.children = [control]; control.parentElement = parent;
  const document = { activeElement: control, createElement: () => new Node("SPAN") };
  const window = { innerWidth: 390, innerHeight: 844, visualViewport: undefined,
    getComputedStyle: (node: Node) => ({ margin: "0px", marginTop: "0px", marginBottom: "0px", flex: "0 1 auto",
      scrollPaddingTop: "8px", scrollPaddingBottom: "34px", paddingTop: node.style.getPropertyValue("padding-top") || "0px" }) };
  const dock = createStarterFocusDock(dialog as unknown as HTMLDialogElement);
  return { dialog, frame, parent, control, document, window, dock,
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
  assert.equal(f.control.getAttribute("popover"), "manual");
  assert.equal(f.control.popoverOpen, true);
  assert.equal(f.control.showCalls, 1);
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

test("a cancelled native show leaves no placeholder, styles or popover attribute behind", () => fixture(f => {
  f.control.showPopover = () => {};
  f.pin();
  assert.equal(f.dock.isDocked(f.control as unknown as HTMLElement), false);
  assert.equal(f.control.getAttribute("popover"), null);
  assert.equal(f.control.classes.has("starter-catalog__focus-docked"), false);
  assert.deepEqual(f.parent.children, [f.control]);
}));

test("a native show exception restores the summary source space", () => fixture(f => {
  f.control.tagName = "SUMMARY"; f.parent.tagName = "DETAILS";
  f.parent.style.setProperty("padding-top", "4px");
  f.control.showPopover = () => { throw new Error("native show unavailable"); };
  f.pin();
  assert.equal(f.parent.style.getPropertyValue("padding-top"), "4px");
  assert.equal(f.control.getAttribute("popover"), null);
  assert.equal(f.control.parentElement, f.parent);
}));

test("restoring native visibility only refocuses the same originally active control without scrolling", () => fixture(f => {
  f.pin();
  const remove = f.control.removeAttribute.bind(f.control);
  f.control.removeAttribute = key => { remove(key); if (key === "popover") f.document.activeElement = new Node("BODY"); };
  f.control.focus = options => { f.control.focusCalls.push(options); f.document.activeElement = f.control; };
  f.dock.release();
  assert.equal(f.document.activeElement, f.control);
  assert.deepEqual(f.control.focusCalls, [{ preventScroll: true }]);
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
