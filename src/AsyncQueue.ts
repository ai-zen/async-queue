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

  /**
   * **同步、不等待**地取干此刻所有匹配的元素。
   *
   * - 不匹配的**留在原地、顺序不变**；
   * - 一条都不匹配就返回空数组（不挂起、也不去要）；
   * - 和 `shift()` 一样会让 `backpressure()` 的等待者放行。
   *
   * 与 `asTakeAll()` 的分工不是重复，是两种问法：这个问「此刻有什么」，
   * 那个问「等到有」。`asTakeAll()` 内部就是本方法套一层等待。
   *
   * 名字不叫 `filter`，是为了避开 TC39 异步迭代器辅助方法里同名的那个（语义也不同：
   * 我们要的是「取走」，不是「换个视图」）。
   */
  public takeAll(filterCallback?: (value: T) => boolean): T[] {
    const taken = this.queue.takeWhere(filterCallback ?? (() => true));

    if (taken.length) {
      // 取走就是「有人消化了」：放行 backpressure 的等待者，与 shift() 同一套信号
      this.shiftTx?.();
      this.shiftRx = new Promise<void>((tx) => (this.shiftTx = tx));
    }

    return taken;
  }

  /**
   * `takeAll()` 的视图：**空则挂起，有货一次取干**，永不吐空数组；
   * `done()` 之后把剩下的吐完再结束。
   *
   * 同一时刻只该有一个迭代器活着（队列配一个消费者）—— 多个迭代器会互相吞值，
   * 那是调用方的事，本类不拦。
   */
  public async *asTakeAll(): AsyncGenerator<T[], void, unknown> {
    while (true) {
      const batch = this.takeAll();

      if (batch.length) {
        yield batch;
        continue;
      }

      if (this.isDone) return;

      await this.pushRx;
    }
  }
}
