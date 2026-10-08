function recorder(log: string[], name: string): Handler {
  return (payload) => {
    log.push(`${name}:${payload}`);
  };
}

test("calls handlers in the order they were added", () => {
  const bus = new Emitter();
  const log: string[] = [];
  bus.on("ping", recorder(log, "a"));
  bus.on("ping", recorder(log, "b"));
  expect(bus.emit("ping", "x")).toBe(2);
  expect(log).toEqual(["a:x", "b:x"]);
});
test("an unsubscribed handler is not called again", () => {
  const bus = new Emitter();
  const log: string[] = [];
  const offA = bus.on("ping", recorder(log, "a"));
  bus.on("ping", recorder(log, "b"));
  offA();
  bus.emit("ping", "x");
  expect(log).toEqual(["b:x"]);
});
test("unsubscribing one handler keeps the ones after it", () => {
  const bus = new Emitter();
  const log: string[] = [];
  bus.on("ping", recorder(log, "a"));
  const offB = bus.on("ping", recorder(log, "b"));
  bus.on("ping", recorder(log, "c"));
  offB();
  bus.emit("ping", "x");
  expect(log).toEqual(["a:x", "c:x"]);
  expect(bus.listenerCount("ping")).toBe(2);
});
test("once runs a single time", () => {
  const bus = new Emitter();
  const log: string[] = [];
  bus.once("ping", recorder(log, "a"));
  bus.emit("ping", "1");
  bus.emit("ping", "2");
  expect(log).toEqual(["a:1"]);
  expect(bus.listenerCount("ping")).toBe(0);
});
test("a handler that unsubscribes itself does not skip the next one", () => {
  const bus = new Emitter();
  const log: string[] = [];
  const off = bus.on("ping", () => off());
  bus.on("ping", recorder(log, "b"));
  expect(bus.emit("ping", "x")).toBe(2);
  expect(log).toEqual(["b:x"]);
});
test("emitting an event nobody listens to runs nothing", () => {
  expect(new Emitter().emit("quiet", "x")).toBe(0);
});
