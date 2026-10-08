type Handler = (payload: string) => void;

// A tiny event emitter.
//  - on(event, handler) subscribes and returns a function that unsubscribes.
//  - once(event, handler) is like on, but the handler runs at most one time.
//  - off(event, handler) removes exactly one subscription.
//  - emit(event, payload) calls the handlers in the order they were added and
//    returns how many ran. A handler may unsubscribe itself (or others) while
//    it runs; that must not make other handlers get skipped.
class Emitter {
  private handlers = new Map<string, Handler[]>();

  on(event: string, handler: Handler): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return () => this.off(event, handler);
  }

  once(event: string, handler: Handler): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(event: string, handler: Handler): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) list.splice(index, 1);
  }

  emit(event: string, payload: string): number {
    const list = this.handlers.get(event) ?? [];
    let ran = 0;
    for (const handler of [...list]) {
      handler(payload);
      ran += 1;
    }
    return ran;
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.length ?? 0;
  }

  clear(event: string): void {
    this.handlers.delete(event);
  }
}
