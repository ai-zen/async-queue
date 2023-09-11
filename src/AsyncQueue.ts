export default class AsyncQueue<T> {
  private dataQueue: (
    | { value: T; done: false }
    | { value: null; done: true }
  )[] = [];
  private resolveQueue: ((value: void | PromiseLike<void>) => void)[] = [];

  public async *[Symbol.asyncIterator]() {
    while (true) {
      while (this.dataQueue.length === 0) {
        await new Promise((resolve) => this.resolveQueue.push(resolve));
      }
      const data = this.dataQueue.shift()!;
      if (data.done) break;
      yield data.value;
    }
  }

  public push(value: T) {
    this.dataQueue.push({ value, done: false });
    this.resolveQueue.shift()?.();
  }

  public done() {
    this.dataQueue.push({ value: null, done: true });
    this.resolveQueue.shift()?.();
  }

  public get size() {
    return this.dataQueue.length;
  }
}
