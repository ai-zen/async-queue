export default class AsyncQueue<T> {
  private dataQueue: T[] = [];
  private resolve?: () => void = undefined;
  private promise?: Promise<unknown> = new Promise<void>(
    (resolve) => (this.resolve = resolve)
  );
  isDone: boolean = false;

  public async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.dataQueue.length) {
        yield this.dataQueue.shift()!;
      } else if (this.isDone) {
        break;
      } else {
        await this.promise;
      }
    }
  }

  public push(value: T) {
    this.dataQueue.push(value);
    this.resolve?.();
    this.promise = new Promise<void>((resolve) => (this.resolve = resolve));
  }

  public done() {
    this.isDone = true;
    this.resolve?.();
  }

  public get size() {
    return this.dataQueue.length;
  }
}
