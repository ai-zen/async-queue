import { LinkedQueue } from "./LinkedQueue.js";

/**
 * `pauseInput()` 期间调用 `push()` 抛的错误。
 *
 * 为什么要具名：调用方得能分辨两件事 ——
 * 「输入暂时关了」（本错误，等 `resumeInput()` 就能继续送），
 * 与「队列已经结束了」（看 `isDone`，再等也不会有人来取）。
 * 一个笼统的 `Error` 让这两件事没法在 `catch` 里分开。
 */
export class QueueInputPausedError extends Error {
  constructor(message: string = "AsyncQueue input is paused") {
    super(message);
    this.name = "QueueInputPausedError";
  }
}

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

  /** 输入开关：关着时 `push()` 抛 `QueueInputPausedError`，不静默丢、也不偷偷缓冲 */
  private inputPaused: boolean = false;

  /** 输出开关：关着时 `takeAll()` 回空、迭代器停在闸上，货原封不动排队 */
  private outputPaused: boolean = false;

  private outputTx?: () => void = undefined;

  /** 输出闸：所有停在闸上的消费者等的是同一个 promise，`resumeOutput()` 一次放行全体 */
  private outputRx: Promise<void> = new Promise<void>(
    (resolve) => (this.outputTx = resolve)
  );

  isDone: boolean = false;

  constructor(iterable?: Iterable<T> | null | undefined) {
    if (iterable) {
      this.queue.push(...iterable);
    }
  }

  /**
   * 停在输出闸上：**只**挂「输出闸翻开」这一个信号（`outputRx`）。
   *
   * `push()` 不叫醒它（闸关着，醒了也一件都取不了，白转一圈）；
   * `done()` 也不叫醒它 —— `done` 只是队列里的一个信号（以后没有新货），
   * 不是开关，不突破输出闸。
   *
   * 醒来必重看闸：闸还关着就接着等 —— 不退出、不取件，存量原样留在队列里。
   */
  private async waitOutputGate(): Promise<void> {
    while (this.outputPaused) {
      await this.outputRx;
    }
  }

  public async *[Symbol.asyncIterator]() {
    while (true) {
      // 闸关着就一件都不取：哪怕队列里已经堆了货也停在闸上（货按原顺序留在原地），
      // 挂起期间到达的货会在放行后按原顺序被取走。
      // 这里不看 `isDone`：`done()` 不突破输出闸 —— 闸关着时它不能把迭代器叫醒收尾，
      // 否则存量留在队列里没人取。放行之后才轮到「取完存量、见 isDone 收尾」。
      if (this.outputPaused) {
        await this.waitOutputGate();
        continue;
      }

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
    if (this.inputPaused) {
      // 闸关着就直说：静默丢等于骗调用方「已经发出去了」，偷偷缓冲等于开关根本没关。
      // 一次 push 多个值时也一个都不入队（要么全收、要么一个都不收）。
      throw new QueueInputPausedError();
    }

    this.queue.push(...values);
    this.pushTx?.();
    this.pushRx = new Promise<void>((tx) => (this.pushTx = tx));
  }

  /**
   * 宣告「以后没有新货了」。
   *
   * 它**只是队列里的一个信号**（以后没有新货），不是开关、不是终点：
   * - 高于输入闸：输入关着也照样置 `isDone`（它是信号，不是输入）；
   * - 不突破输出闸：输出关着时闸上的消费者继续等，不被叫醒、不退出、不取件，
   *   存量留在队列里，等 `resumeOutput()` 之后取完存量再收尾。
   */
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
   *
   * 输出闸关着时**一件都不给**：回空数组，不等待、不抛错，`size` 也不会变 ——
   * 「不给」是暂时的，货还在队列里排着。
   *
   * 它是**取件**，不是清空：要「作废」请用 `clear()`（不看闸、不交货、不碰 `isDone`）。
   * 拿本方法当清空用，暂停中就会清不掉 —— 那是把作废当成了取件。
   */
  public takeAll(filterCallback?: (value: T) => boolean): T[] {
    if (this.outputPaused) return [];

    const taken = this.queue.takeWhere(filterCallback ?? (() => true));

    if (taken.length) {
      // 取走就是「有人消化了」：放行 backpressure 的等待者，与 shift() 同一套信号
      this.shiftTx?.();
      this.shiftRx = new Promise<void>((tx) => (this.shiftTx = tx));
    }

    return taken;
  }

  /**
   * 作废：把队列里的货**全部取出并丢弃**，返回被清掉的那些（顺序即原顺序）。
   *
   * 它是「清空」，不是「取件」，与 `takeAll()` 的差别正是三条：
   *
   * - **两道闸都不看**：清空既不是「收」（`push()`）也不是「取」（`takeAll()` / 迭代器）。
   *   输入闸关着照样清（`pauseInput()` 只拦 `push()`）；输出闸关着**也必须**清得掉 ——
   *   闸上那个「不给」是暂时的、货还排着队，而清空说的是「这些永远不发了」，两件事不该
   *   共用一道门。走取件的门就会被闸挡住，于是「暂停中清不掉」—— 那是把作废当成了取件。
   *
   * - **不唤醒任何消费者**：没有货要交给谁。挂在输出闸上的迭代器仍挂在闸上，
   *   挂在 `pushRx` 上的仍挂着；闸一个字节都不动。
   *
   * - **不碰 `isDone`**：清的是存量，不是「以后还有没有新货」。清完队列照常能收能取。
   *
   * 幂等：空队列回 `[]`。要「取出来用」请还是用 `takeAll()` —— 那才是取件。
   */
  public clear(): T[] {
    const cleared = this.queue.takeWhere(() => true);

    // 唯一会动到的信号是生产侧的「腾出空间」：`backpressure()` 等的是 `size >= max` 不成立，
    // 队列被清空当然该让它重看一眼 —— 它等的不是「交货」，所以不算唤醒消费者。
    if (cleared.length) {
      this.shiftTx?.();
      this.shiftRx = new Promise<void>((tx) => (this.shiftTx = tx));
    }

    return cleared;
  }

  /**
   * `takeAll()` 的视图：**空则挂起，有货一次取干**，永不吐空数组；
   * `done()` 之后把剩下的吐完再结束。
   *
   * 同一时刻只该有一个迭代器活着（队列配一个消费者）—— 多个迭代器会互相吞值，
   * 那是调用方的事，本类不拦。
   *
   * 输出闸关着时和 `[Symbol.asyncIterator]()` 一样停在闸上（否则 `takeAll()` 一直回空，
   * 等闸开了还得等下一次 push 才醒 —— 那就不叫「一开就取」了）。
   */
  public async *asTakeAll(): AsyncGenerator<T[], void, unknown> {
    while (true) {
      // 与 `[Symbol.asyncIterator]()` 同一套：闸关着就挂在闸上，
      // `done()` 也不许把它叫醒收尾（存量还留在队列里等放行）。
      if (this.outputPaused) {
        await this.waitOutputGate();
        continue;
      }

      const batch = this.takeAll();

      if (batch.length) {
        yield batch;
        continue;
      }

      if (this.isDone) return;

      await this.pushRx;
    }
  }

  /**
   * 看一眼：按原顺序把**此刻**队列里的元素抄成数组，**一个都不取走**。
   *
   * 存在的理由：`inboxAdded` / `inboxCleared` 这类事件是「通知」，不是唯一信息源。
   * 只靠它们自建镜像的话，丢一条就与真队列永久分叉 —— 而且没法重读自愈。
   * 有了本方法，「事件 + 随时重读」才真的够用。
   *
   * 返回的数组是拷贝，元素本身还是那一个（不会过期）。
   */
  public snapshot(): T[] {
    return this.queue.toArray();
  }

  /**
   * 关输入：此后 `push()` 抛 `QueueInputPausedError`（不静默丢、不缓冲）。
   *
   * 幂等：重复调用没有额外副作用。
   * 与 `done()` 是两件事：这个只是「暂时不收」，`done()` 是「以后也没有了」。
   */
  public pauseInput(): void {
    this.inputPaused = true;
  }

  /** 开输入：`push()` 恢复正常。幂等。 */
  public resumeInput(): void {
    this.inputPaused = false;
  }

  /** 输入闸当前是否关着（只读现读）。 */
  public get isInputPaused(): boolean {
    return this.inputPaused;
  }

  /**
   * 关输出：`takeAll()` 回空；`for await` 的迭代器停在闸上等放行；
   * `push()` 照收照排队（输入闸归 `pauseInput()` 管，两个开关互不影响）。
   *
   * 幂等：重复调用没有额外副作用。
   */
  public pauseOutput(): void {
    this.outputPaused = true;
  }

  /**
   * 开输出：放行所有停在闸上的消费者，等着的按原顺序继续取。
   *
   * 幂等：闸本来就开着时什么都不做 —— 不去碰闸上那个 promise，
   * 免得把「下一次关闸」的等待者提前放掉。
   */
  public resumeOutput(): void {
    if (!this.outputPaused) return;

    this.outputPaused = false;
    this.outputTx?.();
    this.outputRx = new Promise<void>((tx) => (this.outputTx = tx));
  }

  /** 输出闸当前是否关着（只读现读）。 */
  public get isOutputPaused(): boolean {
    return this.outputPaused;
  }
}
