import { LinkedQueue } from "./LinkedQueue.js";

export default class AsyncQueue<T> {
  private queue: LinkedQueue<T> = new LinkedQueue<T>();
  private pushTx?: () => void = undefined;
  private pushRx?: Promise<void> = new Promise<void>(
    (resolve) => (this.pushTx = resolve)
  );
  private shiftTx?: () => void = undefined;
  private shiftRx?: Promise<void> = new Promise<void>(
    (resolve) => (this.shiftTx = resolve)
  );
  isDone: boolean = false;

  constructor(iterable?: Iterable<T> | null | undefined) {
    if (iterable) {
      this.queue.push(...iterable);
    }
  }

  public async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.queue.size) {
        yield this.shift()!;
      } else if (this.isDone) {
        break;
      } else {
        await this.pushRx;
      }
    }
  }

  public shift() {
    const value = this.queue.shift();
    this.shiftTx?.();
    this.shiftRx = new Promise<void>((tx) => (this.shiftTx = tx));
    return value;
  }

  public push(...values: T[]) {
    this.queue.push(...values);
    this.pushTx?.();
    this.pushRx = new Promise<void>((tx) => (this.pushTx = tx));
  }

  public done() {
    this.isDone = true;
    this.pushTx?.();
  }

  public get size() {
    return this.queue.size;
  }

  public async backpressure(max: number) {
    while (this.size >= max) {
      await this.shiftRx;
    }
  }
}
