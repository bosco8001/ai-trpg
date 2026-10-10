import assert from "node:assert/strict";
import test from "node:test";
import { observeStarterReading } from "../src/web/starter-catalog-reading.js";

// Controlled native-scroll fixture, not a browser/layout or accessibility substitute.
class NativeElement extends EventTarget {
  position = 1440;
  pendingPosition: number | null = null;
  scrollParent: NativeElement | null = null;
  get scrollTop() { return this.position; }
  set scrollTop(value: number) { this.position = value; }
  scroll(value: number | ScrollToOptions = 0, y = 0) {
    if (typeof value !== "number" && value.behavior === "smooth") this.pendingPosition = value.top ?? this.position;
    else this.position = typeof value === "number" ? y : value.top ?? this.position;
  }
  scrollTo(value: number | ScrollToOptions = 0, y = 0) { this.scroll(value, y); }
  scrollBy(value: number | ScrollToOptions = 0, y = 0) {
    this.position += typeof value === "number" ? y : value.top ?? 0;
  }
  scrollIntoView() {
    if (this.scrollParent) this.scrollParent.position = 0;
    else this.position = 0;
  }
  contains(element: unknown) { return element instanceof NativeElement; }
  isContentEditable = false;
  closest() { return null; }
}

function fixture(run: (f: ReturnType<typeof createFixture>) => void) {
  const names = ["window", "document", "Element", "HTMLElement"] as const;
  const original = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const f = createFixture();
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: f.host },
    document: { configurable: true, value: f.document },
    Element: { configurable: true, value: NativeElement },
    HTMLElement: { configurable: true, value: NativeElement },
  });
  try { run(f); }
  finally {
    f.policy?.dispose();
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

function createFixture() {
  const host = new EventTarget() as EventTarget & {
    setTimeout: (callback: () => void, delay: number) => number;
    clearTimeout: (id: number) => void;
  };
  let timerId = 0;
  const timers = new Map<number, () => void>();
  host.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
  host.clearTimeout = id => { timers.delete(id); };
  const dialog = new NativeElement(), frame = new NativeElement(), body = new NativeElement(), focus = new NativeElement();
  focus.scrollParent = frame;
  const document = { activeElement: focus };
  const observations: boolean[] = [];
  let ended = 0;
  const f = {
    host, timers, dialog, frame, body, focus, document, observations,
    policy: null as ReturnType<typeof observeStarterReading> | null,
    ended: () => ended,
    install(): ReturnType<typeof observeStarterReading> {
      f.policy = observeStarterReading(dialog as unknown as HTMLDialogElement,
        [frame, body] as unknown as HTMLElement[], value => observations.push(value), () => ended++);
      return f.policy;
    },
    emitScroll(element: NativeElement) {
      // Native scroll targets the scroller, captured by the parent dialog.
      const event = new Event("scroll");
      Object.defineProperty(event, "target", { value: element });
      dialog.dispatchEvent(event);
    },
    emitEnd(element: NativeElement) {
      const event = new Event("scrollend");
      Object.defineProperty(event, "target", { value: element });
      dialog.dispatchEvent(event);
    },
  };
  return f;
}

test("intermediate native clamp followed by taller content is not a reading command", () => fixture(f => {
  const policy = f.install();
  // Browser internals bypass the JS setter, unlike an explicit scrollTop assignment.
  f.frame.position = 1405;
  f.emitScroll(f.frame);
  f.frame.position = 1405; // Content grows; the earlier maximum is no longer the maximum.
  f.emitScroll(f.frame);
  assert.deepEqual(f.observations, [false, false]);
  assert.equal(policy.isReading(), false);
}));

test("first-rAF programmatic position is recorded before the delayed scroll event", () => fixture(f => {
  const policy = f.install();
  assert.equal(policy.isReading(), false); // Resize alone does not claim reading ownership.
  f.frame.scrollTop = 300; // Caller runs in the first rAF after resize.
  assert.deepEqual(f.observations, [true]);
  assert.equal(policy.isReading(), true); // A pending focus repair must now yield.
  assert.equal(f.frame.scrollTop, 300);
  f.emitScroll(f.frame);
  f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
  assert.equal(f.ended(), 1);
  assert.equal(f.timers.size, 0);
}));

test("scroll method overloads and smooth motion retain reading ownership", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTo(0, 300);
  f.frame.scrollBy({ top: -20 });
  assert.equal(f.frame.scrollTop, 280);
  f.frame.scroll({ top: 100, behavior: "smooth" });
  assert.equal(f.frame.pendingPosition, 100);
  assert.equal(policy.isReading(), true);
  f.frame.position = 200; f.emitScroll(f.frame);
  f.frame.position = 100; f.emitScroll(f.frame);
  assert.equal(f.observations.at(-1), true);
  f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
}));

test("own focus repair does not masquerade as a reading command", () => fixture(f => {
  const policy = f.install();
  policy.repair(() => f.focus.scrollIntoView());
  assert.equal(policy.isReading(), false);
  assert.deepEqual(f.observations, []);
  f.frame.position = 1440;
  f.focus.scrollIntoView();
  assert.equal(policy.isReading(), true);
  assert.deepEqual(f.observations, [true]);
}));

test("wheel input yields until scroll ends; Ctrl-wheel zoom is not reading", () => fixture(f => {
  const policy = f.install();
  const zoom = Object.assign(new Event("wheel"), { deltaX: 0, deltaY: 100, ctrlKey: true });
  f.dialog.dispatchEvent(zoom);
  assert.equal(policy.isReading(), false);
  const wheel = Object.assign(new Event("wheel"), { deltaX: 0, deltaY: 100, ctrlKey: false });
  f.dialog.dispatchEvent(wheel);
  f.frame.position = 300; f.emitScroll(f.frame);
  assert.equal(f.observations.at(-1), true);
  f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
}));

test("quiet fallback ends a no-op command without polling", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTop = f.frame.scrollTop;
  assert.equal(f.timers.size, 1);
  const callback = [...f.timers.values()][0];
  assert.ok(callback); callback();
  assert.equal(policy.isReading(), false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.ended(), 1);
}));

test("scrollbar focus transfer does not lose the active reading gesture", () => fixture(f => {
  const policy = f.install();
  const down = Object.assign(new Event("pointerdown"), {
    isPrimary: true, button: 0, pointerId: 7, clientX: 100, clientY: 100,
  });
  Object.defineProperty(down, "target", { value: f.frame });
  f.dialog.dispatchEvent(down);
  f.document.activeElement = f.dialog;
  f.dialog.dispatchEvent(new Event("focusin"));
  assert.equal(policy.isReading(), true);
  f.frame.position = 300; f.emitScroll(f.frame);
  f.host.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 7 }));
  f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
}));

test("focus navigation transfers the scrollIntoView wrapper and ends old reading", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTop = 300;
  f.document.activeElement = f.body;
  f.dialog.dispatchEvent(new Event("focusin"));
  assert.equal(policy.isReading(), false);
  assert.equal(Object.hasOwn(f.focus, "scrollIntoView"), false);
  assert.equal(Object.hasOwn(f.body, "scrollIntoView"), true);
  f.body.scrollIntoView();
  assert.equal(policy.isReading(), true);
}));

test("closing restores only local API overrides and cancels timers and listeners", () => fixture(f => {
  const getter = Object.getOwnPropertyDescriptor(NativeElement.prototype, "scrollTop");
  const originalScrollTo = NativeElement.prototype.scrollTo;
  const originalFocusScroll = f.focus.scrollIntoView;
  const policy = f.install();
  f.frame.scrollTop = 300;
  const foreign = () => {};
  f.body.scrollTo = foreign; // A later owner must not be overwritten by cleanup.
  policy.dispose();
  assert.equal(f.timers.size, 0);
  assert.equal(Object.hasOwn(f.frame, "scrollTop"), false);
  assert.equal(Object.hasOwn(f.frame, "scrollTo"), false);
  assert.equal(f.focus.scrollIntoView, originalFocusScroll);
  assert.equal(f.body.scrollTo, foreign);
  assert.deepEqual(Object.getOwnPropertyDescriptor(NativeElement.prototype, "scrollTop"), getter);
  assert.equal(NativeElement.prototype.scrollTo, originalScrollTo);
  const count = f.observations.length;
  f.frame.scrollTop = 200; f.emitScroll(f.frame);
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: 100, ctrlKey: false }));
  assert.equal(f.observations.length, count);
  assert.equal(f.timers.size, 0);
}));
