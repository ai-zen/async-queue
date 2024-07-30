export default class AsyncQueue<T> {
  private queue: T[] = [];
  private resolve?: () => void = undefined;
  private promise?: Promise<unknown> = new Promise<void>(
    (resolve) => (this.resolve = resolve)
  );
  isDone: boolean = false;

  constructor(iterable?: Iterable<T> | null | undefined) {
    if (iterable) {
      this.queue.push(...iterable);
    }
  }

  public async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.queue.length) {
        yield this.queue.shift()!;
      } else if (this.isDone) {
        break;
      } else {
        await this.promise;
      }
    }
  }

  public push(...values: T[]) {
    this.queue.push(...values);
    this.resolve?.();
    this.promise = new Promise<void>((resolve) => (this.resolve = resolve));
  }

  public done() {
    this.isDone = true;
    this.resolve?.();
  }

  public get size() {
    return this.queue.length;
  }
}
