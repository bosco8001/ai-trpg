import assert from "node:assert/strict";
import test from "node:test";
import { observeStarterReading } from "../src/web/starter-catalog-reading.js";

// Controlled native-scroll fixture, not a browser/layout or accessibility substitute.
class NativeElement extends EventTarget {
  position = 1440;
  clientWidth = 400;
  clientHeight = 300;
  scrollHeight = 1740;
  pendingPosition: number | null = null;
  scrollParent: NativeElement | null = null;
  rectTop = 0;
  getBoundingClientRect() { return { top: this.rectTop, bottom: this.rectTop + this.clientHeight }; }
  get scrollTop() { return this.position; }
  set scrollTop(value: number) { this.position = value; }
  scroll(value: number | ScrollToOptions = 0, y = 0) {
    if (typeof value !== "number" && value.behavior === "smooth") this.pendingPosition = value.top ?? this.position;
    else this.position = typeof value === "number" ? y : value.top ?? this.position;
  }
  scrollTo(value: number | ScrollToOptions = 0, y = 0) {
    // Native scrollTo does not dispatch through an instance's JS scroll wrapper.
    NativeElement.prototype.scroll.call(this, value, y);
  }
  scrollBy(value: number | ScrollToOptions = 0, y = 0) {
    this.position += typeof value === "number" ? y : value.top ?? 0;
  }
  scrollIntoView(options: ScrollIntoViewOptions = {}) {
    if (this.scrollParent && options.behavior === "smooth") this.scrollParent.pendingPosition = 0;
    else if (this.scrollParent) this.scrollParent.position = 0;
    else this.position = 0;
  }
  contains(element: unknown) { return element instanceof NativeElement; }
  isContentEditable = false;
  closest() { return null; }
}

function fixture(run: (f: ReturnType<typeof createFixture>) => void) {
  const names = ["window", "document", "Element", "HTMLElement", "performance"] as const;
  const original = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const f = createFixture();
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: f.host },
    document: { configurable: true, value: f.document },
    Element: { configurable: true, value: NativeElement },
    HTMLElement: { configurable: true, value: NativeElement },
    performance: { configurable: true, value: { now: () => f.now } },
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
  const endings: boolean[] = [];
  const f = {
    host, timers, dialog, frame, body, focus, document, observations, now: 0,
    policy: null as ReturnType<typeof observeStarterReading> | null,
    ended: () => endings.length,
    endings,
    install(): ReturnType<typeof observeStarterReading> {
      f.policy = observeStarterReading(dialog as unknown as HTMLDialogElement,
        [frame, body] as unknown as HTMLElement[], value => observations.push(value), moved => endings.push(moved));
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
  f.frame.scrollHeight = 1705; f.frame.position = 1405;
  policy.layoutChanged(); // This older case does expose the intermediate maximum.
  f.frame.scrollHeight = 2300; // Content grows before scroll event delivery.
  policy.sampleLayout();
  f.emitScroll(f.frame);
  assert.deepEqual(f.observations, [false]);
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
  policy.repair(() => { f.frame.position = 1440; });
  f.focus.scrollIntoView();
  assert.equal(policy.isReading(), true);
  assert.deepEqual(f.observations, [true]);
}));

test("wheel input yields until scroll ends; Ctrl-wheel zoom is not reading", () => fixture(f => {
  const policy = f.install();
  const zoom = Object.assign(new Event("wheel"), { deltaX: 0, deltaY: 100, ctrlKey: true });
  f.dialog.dispatchEvent(zoom);
  assert.equal(policy.isReading(), false);
  const wheel = Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -100, ctrlKey: false });
  f.dialog.dispatchEvent(wheel);
  f.frame.position = 300; f.emitScroll(f.frame);
  assert.equal(f.observations.at(-1), true);
  f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
}));

test("a no-op setter creates no session, timer or reading ownership", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTop = f.frame.scrollTop;
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.observations, []);
  assert.equal(policy.isReading(), false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.ended(), 0);
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


test("passive wheel sees compositor movement that happened before its listener", () => fixture(f => {
  f.install();
  f.frame.position = 1140; // Chrome compositor has moved before passive wheel delivery.
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -300, ctrlKey: false }));
  f.emitScroll(f.frame); // The delayed event has no additional displacement.
  f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [true]);
  assert.deepEqual(f.endings, [true]);
  assert.equal(f.timers.size, 0);
}));

for (const source of ["End", "ArrowDown", "wheel", "setter", "scrollTo", "scrollBy"] as const) {
  test(`no-op ${source} then orientation clamp is not reading displacement`, () => fixture(f => {
    const policy = f.install();
    if (source === "End" || source === "ArrowDown") {
      f.dialog.dispatchEvent(Object.assign(new Event("keydown"), { key: source }));
    } else if (source === "wheel") {
      f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: 300, ctrlKey: false }));
    } else if (source === "setter") f.frame.scrollTop = f.frame.scrollTop;
    else if (source === "scrollTo") f.frame.scrollTo({ top: f.frame.scrollTop });
    else f.frame.scrollBy({ top: 0 });
    assert.deepEqual(f.observations, []);
    f.frame.scrollHeight = 1099; f.frame.position = 799;
    policy.layoutChanged(); f.emitScroll(f.frame);
    f.emitEnd(f.frame);
    assert.deepEqual(f.observations, [false]);
    assert.deepEqual(f.endings, []);
    assert.equal(policy.isReading(), false);
    assert.equal(f.timers.size, 0);
  }));
}

for (const source of ["prototype method", "prototype setter", "nonfocus descendant", "nonconfigurable"] as const) {
  test(`unwrapped ${source} cannot override the native reflow focus anchor`, () => fixture(f => {
    if (source === "nonconfigurable") Object.defineProperty(f.frame, "scrollTop", {
      configurable: false, get: () => f.frame.position,
      set: (value: number) => { f.frame.position = value; },
    });
    const policy = f.install();
    f.frame.clientWidth = 399; policy.layoutChanged(); // Resize was requested first.
    if (source === "prototype method") NativeElement.prototype.scrollTo.call(f.frame, 0, 300);
    else if (source === "prototype setter") {
      Object.getOwnPropertyDescriptor(NativeElement.prototype, "scrollTop")?.set?.call(f.frame, 300);
    } else if (source === "nonfocus descendant") {
      const other = new NativeElement(); other.scrollParent = f.frame; other.scrollIntoView();
    } else f.frame.scrollTop = 300;
    policy.sampleLayout(); // Before the bounded second-frame correction.
    f.emitScroll(f.frame); f.emitEnd(f.frame);
    assert.deepEqual(f.observations, [false]);
    assert.deepEqual(f.endings, []);
    assert.equal(policy.isReading(), false);
  }));
}

test("reading followed by a native clamp does not overwrite the last reading baseline", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTop = 1000;
  f.frame.scrollHeight = 800; f.frame.position = 500;
  policy.layoutChanged(); f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [true, false]);
  assert.deepEqual(f.endings, []);
}));

test("internal reset followed by a delayed native scroll does not start reading", () => fixture(f => {
  const policy = f.install();
  policy.repair(() => { f.frame.scrollTop = 0; });
  f.emitScroll(f.frame);
  assert.equal(policy.isReading(), false);
  assert.deepEqual(f.observations, []);
  assert.equal(f.timers.size, 0);
}));

// No intermediate maximum is supplied to JS. These traces exercise the source
// policy; Grok must separately reproduce H-2 with real browser layout and focus.
for (const eventFirst of [false, true]) {
  for (const command of ["none", "End", "ArrowDown", "wheel", "setter", "scrollTo", "scrollBy"] as const) {
    test(`unobserved intermediate clamp: ${command}, scroll ${eventFirst ? "before" : "after"} resize`, () => fixture(f => {
      const policy = f.install();
      if (command === "End" || command === "ArrowDown")
        f.dialog.dispatchEvent(Object.assign(new Event("keydown"), { key: command }));
      else if (command === "wheel")
        f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: 300, ctrlKey: false }));
      else if (command === "setter") f.frame.scrollTop = f.frame.scrollTop;
      else if (command === "scrollTo") Reflect.apply(f.frame.scrollTo, f.frame, ["x"]);
      else if (command === "scrollBy") f.frame.scrollBy(NaN);
      assert.equal(policy.isReading(), false);
      assert.equal(f.timers.size, 0);
      // The browser used a transient maximum of 1315 internally. JS only ever
      // sees the final range, where neither 1440 nor 1315 exceeds maximum 1829.
      f.frame.clientWidth = 390; f.frame.clientHeight = 568;
      f.frame.scrollHeight = 2397; f.frame.position = 1315;
      if (eventFirst) f.emitScroll(f.frame);
      policy.layoutChanged(); policy.sampleLayout(); policy.sampleLayout();
      if (!eventFirst) f.emitScroll(f.frame);
      f.emitEnd(f.frame);
      assert.deepEqual(f.observations, [false]);
      assert.deepEqual(f.endings, []);
      assert.equal(policy.isReading(), false);
      assert.equal(f.timers.size, 0);
    }));
  }
}

test("a layout sample before delayed scroll does not consume a known wheel origin", () => fixture(f => {
  const policy = f.install();
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -300, ctrlKey: false }));
  f.frame.position = 1140;
  policy.sampleLayout();
  assert.deepEqual(f.observations, [false]);
  f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [false, true]);
  assert.deepEqual(f.endings, [true]);
  assert.equal(policy.isReading(), false);
}));

test("a layout sample before passive wheel delivery retains its uncredited movement", () => fixture(f => {
  const policy = f.install();
  policy.layoutChanged();
  f.frame.position = 1140; policy.sampleLayout();
  assert.deepEqual(f.observations, [false]);
  assert.equal(policy.isReading(), false);
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -300, ctrlKey: false }));
  f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [false, true]);
  assert.deepEqual(f.endings, [true]);
  assert.equal(f.timers.size, 0);
}));

test("layout notification discards an uncredited delta before a later wheel", () => fixture(f => {
  const policy = f.install();
  f.frame.position = 1140; policy.sampleLayout();
  policy.layoutChanged();
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -300, ctrlKey: false }));
  f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [false]);
  assert.deepEqual(f.endings, [false]);
  assert.equal(policy.isReading(), false);
}));

test("a new bottom End cannot reuse an earlier upward wheel ticket", () => fixture(f => {
  const policy = f.install();
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -100, ctrlKey: false }));
  assert.equal(policy.isReading(), true);
  f.dialog.dispatchEvent(Object.assign(new Event("keydown"), { key: "End" }));
  assert.equal(policy.isReading(), false);
  f.frame.position = 1315; f.emitScroll(f.frame);
  assert.deepEqual(f.observations, [false]);
  assert.deepEqual(f.endings, [false]);
  assert.equal(f.timers.size, 0);
}));

test("a no-op setter replaces an earlier pending smooth command", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTo({ top: 300, behavior: "smooth" });
  assert.equal(policy.isReading(), true);
  f.frame.scrollTop = f.frame.scrollTop;
  assert.equal(policy.isReading(), false);
  f.frame.position = 1315; f.emitScroll(f.frame);
  assert.deepEqual(f.observations, [false]);
  assert.equal(f.timers.size, 0);
}));

test("unconfirmed smooth is invalidated by layout, even with the same final geometry", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTo({ top: 300, behavior: "smooth" });
  policy.layoutChanged();
  f.frame.position = 1315; policy.sampleLayout(); f.emitScroll(f.frame);
  assert.deepEqual(f.observations, [false]);
  assert.equal(policy.isReading(), false);
  assert.equal(f.timers.size, 0);
}));

test("simple-data smooth at the same destination grants no ownership", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTo({ top: 1440, behavior: "smooth" });
  assert.equal(policy.isReading(), false);
  assert.equal(f.timers.size, 0);
}));

test("delayed focused smooth remains unconfirmed instead of guessing its native target", () => fixture(f => {
  const policy = f.install();
  f.focus.rectTop = -100; f.focus.clientHeight = 44;
  f.focus.scrollIntoView({ behavior: "smooth", block: "nearest" });
  assert.equal(f.frame.pendingPosition, 0);
  assert.equal(policy.isReading(), false);
  f.frame.position = 1000; policy.sampleLayout(); f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [false]);
  assert.deepEqual(f.endings, []);
  assert.equal(f.timers.size, 0);
}));

test("opaque option getters are not read again to manufacture smooth intent", () => fixture(f => {
  const policy = f.install();
  let reads = 0;
  f.frame.scrollTo({ top: 300, get behavior() { reads++; return "smooth" as const; } });
  assert.equal(reads, 1);
  assert.equal(f.frame.pendingPosition, 300); // Native call received the original options.
  assert.equal(policy.isReading(), false);
  assert.equal(f.timers.size, 0);
}));

test("ordinary pointer hold does not prevent a wheel session from ending", () => fixture(f => {
  const policy = f.install();
  const down = Object.assign(new Event("pointerdown"), {
    isPrimary: true, button: 0, pointerId: 7, clientX: 100, clientY: 100,
  });
  Object.defineProperty(down, "target", { value: f.focus });
  f.dialog.dispatchEvent(down);
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -100, ctrlKey: false }));
  f.frame.position = 300; f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
  assert.deepEqual(f.endings, [true]);
  assert.equal(f.timers.size, 0);
}));

test("touch reversal follows the last pointer position rather than its original origin", () => fixture(f => {
  const policy = f.install();
  f.frame.position = 1000; policy.repair(() => {});
  const down = Object.assign(new Event("pointerdown"), {
    isPrimary: true, button: 0, pointerId: 7, clientX: 100, clientY: 100,
  });
  Object.defineProperty(down, "target", { value: f.focus });
  f.dialog.dispatchEvent(down);
  f.host.dispatchEvent(Object.assign(new Event("pointermove"), { pointerId: 7, clientX: 100, clientY: 80 }));
  f.frame.position = 1020; f.emitScroll(f.frame);
  f.host.dispatchEvent(Object.assign(new Event("pointermove"), { pointerId: 7, clientX: 100, clientY: 90 }));
  f.frame.position = 1010; f.emitScroll(f.frame);
  f.host.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 7 }));
  f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [true, true]);
  assert.deepEqual(f.endings, [true]);
  assert.equal(policy.isReading(), false);
}));

test("horizontal pointer movement cannot claim unrelated vertical displacement", () => fixture(f => {
  const policy = f.install();
  const down = Object.assign(new Event("pointerdown"), {
    isPrimary: true, button: 0, pointerId: 7, clientX: 100, clientY: 100,
  });
  Object.defineProperty(down, "target", { value: f.focus });
  f.dialog.dispatchEvent(down);
  f.host.dispatchEvent(Object.assign(new Event("pointermove"), { pointerId: 7, clientX: 150, clientY: 100 }));
  f.frame.position = 1315; f.emitScroll(f.frame);
  assert.deepEqual(f.observations, [false]);
  assert.equal(policy.isReading(), false);
  assert.equal(f.timers.size, 0);
}));

test("held scrollbar still yields focus repair after layout until release", () => fixture(f => {
  const policy = f.install();
  const down = Object.assign(new Event("pointerdown"), {
    isPrimary: true, button: 0, pointerId: 7, clientX: 100, clientY: 100,
  });
  Object.defineProperty(down, "target", { value: f.frame });
  f.dialog.dispatchEvent(down);
  policy.layoutChanged();
  assert.equal(policy.isReading(), true);
  f.host.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 7 }));
  const callback = [...f.timers.values()][0];
  assert.ok(callback); callback();
  assert.equal(policy.isReading(), false);
  assert.equal(f.timers.size, 0);
}));

test("unrelated body scrollend cannot end a pending frame smooth request", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTo({ top: 300, behavior: "smooth" });
  f.emitEnd(f.body);
  assert.equal(policy.isReading(), true);
  f.frame.position = 300; f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
  assert.deepEqual(f.endings, [true]);
}));

test("a body no-op setter cannot discard the frame's pending smooth command", () => fixture(f => {
  const policy = f.install();
  f.frame.scrollTo({ top: 300, behavior: "smooth" });
  f.body.scrollTop = f.body.scrollTop;
  assert.equal(policy.isReading(), true);
  f.frame.position = 300; f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.equal(policy.isReading(), false);
  assert.deepEqual(f.endings, [true]);
}));

test("a body no-op setter cannot consume frame compositor movement before wheel delivery", () => fixture(f => {
  const policy = f.install();
  f.frame.position = 1140;
  f.body.scrollTop = f.body.scrollTop;
  f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -300, ctrlKey: false }));
  f.emitScroll(f.frame); f.emitEnd(f.frame);
  assert.deepEqual(f.observations, [true]);
  assert.deepEqual(f.endings, [true]);
  assert.equal(policy.isReading(), false);
}));

for (const first of ["frame", "body"] as const) {
  test(`independent smooth requests retain the other source after ${first} ends`, () => fixture(f => {
    const policy = f.install(), next = first === "frame" ? "body" : "frame";
    f.frame.scrollTo({ top: 300, behavior: "smooth" });
    f.body.scrollTo({ top: 300, behavior: "smooth" });
    f[first].position = 300; f.emitScroll(f[first]); f.emitEnd(f[first]);
    assert.equal(policy.isReading(), true);
    f[next].position = 300; f.emitScroll(f[next]); f.emitEnd(f[next]);
    assert.deepEqual(f.observations, [true, true]);
    assert.deepEqual(f.endings, [true]);
    assert.equal(policy.isReading(), false);
    assert.equal(f.timers.size, 0);
  }));
}

for (const boundary of [0, 1440]) {
  test(`a new no-op wheel at ${boundary} cannot credit an earlier cached unknown displacement`, () => fixture(f => {
    const policy = f.install();
    policy.repair(() => { f.frame.position = 1000; f.body.position = boundary; });
    f.frame.position = boundary; policy.sampleLayout();
    f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0,
      deltaY: boundary === 0 ? -300 : 300, ctrlKey: false }));
    f.emitEnd(f.frame);
    assert.deepEqual(f.observations, [false]);
    assert.equal(policy.isReading(), false);
    assert.equal(f.timers.size, 0);
  }));
}

for (const age of [249, 250, 251, 300]) {
  test(`uncredited movement at age ${age}ms has a deterministic freshness boundary`, () => fixture(f => {
    const policy = f.install();
    f.frame.position = 1140; policy.sampleLayout();
    f.now = age;
    f.dialog.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 0, deltaY: -300, ctrlKey: false }));
    f.emitEnd(f.frame);
    assert.deepEqual(f.observations, age <= 250 ? [false, true] : [false]);
    assert.deepEqual(f.endings, [age <= 250]);
    assert.equal(policy.isReading(), false);
    assert.equal(f.timers.size, 0);
  }));
}

test("a native API that closes the observer cannot record afterward", () => fixture(f => {
  Object.defineProperty(f.frame, "scrollTo", { configurable: true, value: () => {
    f.frame.position = 300; f.policy?.dispose(); return "native-result";
  } });
  f.install();
  assert.equal(f.frame.scrollTo(0, 300), "native-result");
  assert.deepEqual(f.observations, []);
  assert.equal(f.timers.size, 0);
}));

test("a throwing native method leaves no new source and preserves its exception", () => fixture(f => {
  const failure = new Error("native-failure");
  Object.defineProperty(f.frame, "scrollTo", { configurable: true, value: () => { throw failure; } });
  const policy = f.install();
  assert.throws(() => f.frame.scrollTo({ top: 300, behavior: "smooth" }), error => error === failure);
  assert.equal(policy.isReading(), false);
  assert.deepEqual(f.observations, []);
  assert.equal(f.timers.size, 0);
}));

test("a borrowed wrapper preserves the foreign receiver without observing it", () => fixture(f => {
  const policy = f.install(), other = new NativeElement();
  f.frame.scrollTo.call(other, 0, 300);
  assert.equal(other.scrollTop, 300);
  assert.equal(f.frame.scrollTop, 1440);
  assert.equal(policy.isReading(), false);
  assert.deepEqual(f.observations, []);
  assert.equal(f.timers.size, 0);
}));
