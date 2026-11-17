import { describe, expect, test } from "vitest";
import AsyncQueue, { QueueInputPausedError } from "./AsyncQueue.js";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("AsyncQueue", () => {
  test("constructor", () => {
    const queue = new AsyncQueue([1, 2, 3]);

    expect(queue.size).toBe(3);
  });

  test("push should add value to the queue and increase size", () => {
    const queue = new AsyncQueue<number>();

    queue.push(1);
    expect(queue.size).toBe(1);

    queue.push(2, 3);
    expect(queue.size).toBe(3);

    queue.push(4, 5, 6);
    expect(queue.size).toBe(6);
  });

  test("done should mark the queue as done", () => {
    const queue = new AsyncQueue<number>();

    queue.done();
    expect(queue.isDone).toBe(true);
  });

  test("asyncIterator should iterate over the data queue", async () => {
    const queue = new AsyncQueue([1, 2, 3]);
    const result: number[] = [];

    (async () => {
      for (const value of [4, 5, 6]) {
        await sleep(1);
        queue.push(value);
      }
      queue.done();
    })();

    for await (const value of queue) {
      await sleep(1);
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("asyncIterator should allow multiple consumers", async () => {
    const queue = new AsyncQueue([1, 2, 3]);
    const result: number[] = [];

    (async () => {
      for (const value of [4, 5, 6]) {
        await sleep(1);
        queue.push(value);
      }
      queue.done();
    })();

    await Promise.all(
      Array.from({ length: 3 }).map(async () => {
        for await (const value of queue) {
          await sleep(1);
          result.push(value);
        }
      })
    );

    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("backpressure should work", async () => {
    const queue = new AsyncQueue<number>();
    const result: number[] = [];

    (async () => {
      for (const value of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        await sleep(1);
        await queue.backpressure(4); // wait for the queue to have space
        expect(queue.size).toBeLessThanOrEqual(3);
        queue.push(value);
        expect(queue.size).toBeLessThanOrEqual(4);
      }
      queue.done();
    })();

    for await (const value of queue) {
      await sleep(10);
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("AsyncQueue.takeAll", () => {
  test("without a callback it takes everything", () => {
    const queue = new AsyncQueue([1, 2, 3]);

    expect(queue.takeAll()).toEqual([1, 2, 3]);
    expect(queue.size).toBe(0);
  });

  test("takes only matching values and keeps the rest in order", () => {
    const queue = new AsyncQueue([1, 2, 3, 4, 5, 6]);

    expect(queue.takeAll((value) => value % 2 === 1)).toEqual([1, 3, 5]);
    expect(queue.size).toBe(3);

    expect(queue.takeAll()).toEqual([2, 4, 6]);
    expect(queue.size).toBe(0);
  });

  test("returns an empty array when nothing matches", () => {
    const queue = new AsyncQueue([1, 2, 3]);

    expect(queue.takeAll((value) => value > 100)).toEqual([]);
    expect(queue.size).toBe(3);
    expect(queue.takeAll()).toEqual([1, 2, 3]);
  });

  test("keeps the queue usable after everything is taken", () => {
    const queue = new AsyncQueue([1, 2]);

    expect(queue.takeAll(() => true)).toEqual([1, 2]);
    expect(queue.size).toBe(0);

    queue.push(3);
    expect(queue.shift()).toBe(3);
  });

  test("keeps tail valid when the last node is taken", () => {
    const queue = new AsyncQueue([1, 2, 3]);

    expect(queue.takeAll((value) => value >= 3)).toEqual([3]);

    queue.push(4, 5);
    expect(queue.takeAll()).toEqual([1, 2, 4, 5]);
  });

  test("releases backpressure waiters", async () => {
    const queue = new AsyncQueue([1, 2, 3, 4, 5]);
    let released = false;

    const waiter = queue.backpressure(4).then(() => {
      released = true;
    });

    await sleep(5);
    expect(released).toBe(false);

    queue.takeAll();
    await waiter;

    expect(released).toBe(true);
    expect(queue.size).toBe(0);
  });
});

describe("AsyncQueue.asTakeAll", () => {
  test("hangs while empty, then takes the whole batch at once", async () => {
    const queue = new AsyncQueue<number>();
    const batches: number[][] = [];

    const consumer = (async () => {
      for await (const batch of queue.asTakeAll()) {
        batches.push(batch);
      }
    })();

    await sleep(5);
    // 空的时候既不吐空数组，也不结束
    expect(batches).toEqual([]);

    queue.push(1, 2, 3);
    await sleep(5);
    expect(batches).toEqual([[1, 2, 3]]);

    queue.push(4);
    queue.push(5);
    await sleep(5);
    // 一次取干，不按 push 的次数分批
    expect(batches).toEqual([[1, 2, 3], [4, 5]]);

    queue.done();
    await consumer;
    expect(batches).toEqual([[1, 2, 3], [4, 5]]);
  });

  test("drains what is left after done() and then ends", async () => {
    const queue = new AsyncQueue([1, 2, 3]);
    queue.done();

    const batches: number[][] = [];
    for await (const batch of queue.asTakeAll()) {
      batches.push(batch);
    }

    expect(batches).toEqual([[1, 2, 3]]);
  });

  test("waits again after a batch was consumed", async () => {
    const queue = new AsyncQueue([1]);
    const batches: number[][] = [];

    const consumer = (async () => {
      for await (const batch of queue.asTakeAll()) {
        batches.push(batch);
      }
    })();

    await sleep(5);
    expect(batches).toEqual([[1]]);

    queue.push(2);
    await sleep(5);
    expect(batches).toEqual([[1], [2]]);

    queue.done();
    await consumer;
  });
});

describe("AsyncQueue.snapshot", () => {
  test("reads the whole queue in order without taking anything", () => {
    const queue = new AsyncQueue([1, 2, 3]);

    expect(queue.snapshot()).toEqual([1, 2, 3]);
    expect(queue.size).toBe(3);
    expect(queue.snapshot()).toEqual([1, 2, 3]);
  });

  test("returns a copy, not the live structure", () => {
    const queue = new AsyncQueue([1]);
    const snap = queue.snapshot();

    snap.push(999);
    queue.push(2);

    expect(queue.snapshot()).toEqual([1, 2]);
  });

  test("reflects takeAll immediately", () => {
    const queue = new AsyncQueue([1, 2, 3, 4]);

    queue.takeAll((value) => value % 2 === 0);

    expect(queue.snapshot()).toEqual([1, 3]);
  });

  test("is empty after done() once drained", async () => {
    const queue = new AsyncQueue([1, 2]);
    queue.done();

    for await (const _batch of queue.asTakeAll()) {
      // 取干
    }

    expect(queue.snapshot()).toEqual([]);
  });
});

describe("AsyncQueue 输入开关 / 输出开关", () => {
  test("pauseInput 后 push 抛具名错误，resumeInput 后恢复正常", () => {
    const queue = new AsyncQueue<number>([1, 2]);

    queue.pauseInput();
    expect(queue.isInputPaused).toBe(true);

    expect(() => queue.push(3)).toThrow(QueueInputPausedError);
    // 抛错就是没入队：不静默丢，也不偷偷缓冲 —— 缓冲了等于开关根本没关
    expect(queue.size).toBe(2);

    let caught: unknown;
    try {
      queue.push(3, 4);
    } catch (error) {
      caught = error;
    }

    // 一次 push 多个值时一个都不进，且错误是调用方能分辨的具名类型
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(QueueInputPausedError);
    expect((caught as Error).name).toBe("QueueInputPausedError");
    expect(queue.size).toBe(2);

    queue.resumeInput();
    expect(queue.isInputPaused).toBe(false);

    queue.push(3, 4);
    expect(queue.size).toBe(4);
    expect(queue.takeAll()).toEqual([1, 2, 3, 4]);
  });

  test("pauseOutput 时 takeAll 回空且 size 不变", () => {
    const queue = new AsyncQueue([1, 2, 3]);

    queue.pauseOutput();
    expect(queue.isOutputPaused).toBe(true);

    // 不等待、不抛错，就回空数组
    expect(queue.takeAll()).toEqual([]);
    expect(queue.takeAll((value) => value > 1)).toEqual([]);
    expect(queue.size).toBe(3);

    // 只读现读：看一眼不算取走
    expect(queue.snapshot()).toEqual([1, 2, 3]);

    queue.resumeOutput();
    expect(queue.isOutputPaused).toBe(false);
    expect(queue.takeAll()).toEqual([1, 2, 3]);
  });

  test("pauseOutput 时 for await 挂在闸上，resumeOutput 后按原顺序取出", async () => {
    const queue = new AsyncQueue<number>([1, 2]);
    queue.pauseOutput();

    const taken: number[] = [];
    const consumer = (async () => {
      for await (const value of queue) taken.push(value);
    })();

    await sleep(5);
    // 存量一口都没被取走
    expect(taken).toEqual([]);
    expect(queue.size).toBe(2);

    // 挂起期间到达的货照收照排队
    queue.push(3, 4);
    await sleep(5);
    expect(taken).toEqual([]);
    expect(queue.size).toBe(4);

    queue.resumeOutput();
    await sleep(5);
    expect(taken).toEqual([1, 2, 3, 4]);
    expect(queue.size).toBe(0);

    queue.done();
    await consumer;
  });

  test("pauseOutput 时 asTakeAll 也挂在闸上，resumeOutput 后一次取干", async () => {
    const queue = new AsyncQueue<number>([1]);
    queue.pauseOutput();

    const batches: number[][] = [];
    const consumer = (async () => {
      for await (const batch of queue.asTakeAll()) batches.push(batch);
    })();

    await sleep(5);
    expect(batches).toEqual([]);

    queue.push(2);
    await sleep(5);
    expect(batches).toEqual([]);

    queue.resumeOutput();
    await sleep(5);
    expect(batches).toEqual([[1, 2]]);

    queue.done();
    await consumer;
  });

  test("多消费者时所有迭代器都停在闸上，resumeOutput 一起放行", async () => {
    const queue = new AsyncQueue<number>([1, 2, 3, 4]);
    queue.pauseOutput();

    const sinks: number[][] = [[], []];
    const consumers = sinks.map((sink) =>
      (async () => {
        for await (const value of queue) sink.push(value);
      })()
    );

    await sleep(5);
    expect(sinks).toEqual([[], []]);
    expect(queue.size).toBe(4);

    queue.resumeOutput();
    await sleep(10);
    queue.done();
    await Promise.all(consumers);

    // 谁抢到哪条是竞争的事，但四条货一条不少
    expect(sinks.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  test("两个开关都是幂等的", async () => {
    const queue = new AsyncQueue<number>([1, 2]);

    expect(queue.isInputPaused).toBe(false);
    expect(queue.isOutputPaused).toBe(false);

    queue.pauseInput();
    queue.pauseInput();
    expect(queue.isInputPaused).toBe(true);
    expect(() => queue.push(3)).toThrow(QueueInputPausedError);

    queue.resumeInput();
    queue.resumeInput();
    expect(queue.isInputPaused).toBe(false);
    queue.push(3);
    expect(queue.size).toBe(3);

    queue.pauseOutput();
    queue.pauseOutput();
    expect(queue.isOutputPaused).toBe(true);
    expect(queue.takeAll()).toEqual([]);

    queue.resumeOutput();
    queue.resumeOutput();
    expect(queue.isOutputPaused).toBe(false);
    expect(queue.takeAll()).toEqual([1, 2, 3]);

    // 重复 resumeOutput 不会把闸上那个 promise 提前放掉：再关一次照样管用
    queue.pauseOutput();
    const taken: number[] = [];
    const consumer = (async () => {
      for await (const value of queue) taken.push(value);
    })();

    queue.push(4);
    await sleep(5);
    expect(taken).toEqual([]);

    queue.resumeOutput();
    await sleep(5);
    expect(taken).toEqual([4]);

    queue.done();
    await consumer;
  });

  test("done() 不突破输出闸：挂在闸上的迭代器继续等，resumeOutput 后才收尾", async () => {
    const queue = new AsyncQueue<number>();
    queue.pauseOutput();

    const taken: number[] = [];
    let finished = false;
    const consumer = (async () => {
      for await (const value of queue) taken.push(value);
      finished = true;
    })();

    await sleep(5);
    expect(finished).toBe(false);

    queue.done();
    await sleep(5);

    // done 只是队列里的一个信号（以后没有新货），不是开关：闸还关着，
    // 它就不许把闸上的迭代器叫醒收尾 —— 没退出、没取件（这里本来也没货）
    expect(finished).toBe(false);
    expect(taken).toEqual([]);
    expect(queue.isOutputPaused).toBe(true);
    expect(queue.isDone).toBe(true);

    // 闸开了才轮到收尾：队列空，取不到东西就直接结束
    queue.resumeOutput();
    await consumer;

    expect(finished).toBe(true);
    expect(taken).toEqual([]);
  });

  test("pauseOutput 期间 done()：迭代器仍挂在闸上，resumeOutput 后取完存量再结束", async () => {
    const queue = new AsyncQueue<number>([1, 2]);
    queue.pauseOutput();

    const taken: number[] = [];
    let finished = false;
    const consumer = (async () => {
      for await (const value of queue) taken.push(value);
      finished = true;
    })();

    await sleep(5);
    queue.done();
    await sleep(5);

    // done() 不突破输出闸：没退出、一件没取、size 不变，存量原样留在队列里
    expect(finished).toBe(false);
    expect(taken).toEqual([]);
    expect(queue.size).toBe(2);
    expect(queue.snapshot()).toEqual([1, 2]);

    // 闸开了才取：按原顺序取完存量，看见 isDone 才收尾
    queue.resumeOutput();
    await consumer;

    expect(taken).toEqual([1, 2]);
    expect(queue.size).toBe(0);
    expect(finished).toBe(true);
  });

  test("两个开关互不影响", async () => {
    const queue = new AsyncQueue<number>([1]);
    queue.pauseInput();
    queue.pauseOutput();

    expect(queue.isInputPaused).toBe(true);
    expect(queue.isOutputPaused).toBe(true);

    // 输入关着：push 抛错，与输出闸的状态无关
    expect(() => queue.push(2)).toThrow(QueueInputPausedError);
    // 输出关着：takeAll 回空，与输入闸的状态无关
    expect(queue.takeAll()).toEqual([]);

    // 开输出不动输入
    queue.resumeOutput();
    expect(queue.isOutputPaused).toBe(false);
    expect(queue.isInputPaused).toBe(true);
    expect(queue.takeAll()).toEqual([1]);
    expect(() => queue.push(2)).toThrow(QueueInputPausedError);

    // 开输入不动输出
    queue.resumeInput();
    expect(queue.isInputPaused).toBe(false);
    expect(queue.isOutputPaused).toBe(false);

    queue.push(2);
    expect(queue.takeAll()).toEqual([2]);
  });

  test("pauseInput 不影响取件：存量照旧能取，迭代器照旧能跑", async () => {
    const queue = new AsyncQueue<number>([1, 2]);
    queue.pauseInput();

    const taken: number[] = [];
    const consumer = (async () => {
      for await (const value of queue) taken.push(value);
    })();

    await sleep(5);
    expect(taken).toEqual([1, 2]);

    // 差最后一条：迭代器正等着货，输入闸关着谁也送不进来
    expect(queue.size).toBe(0);

    queue.resumeInput();
    queue.push(3);
    await sleep(5);
    expect(taken).toEqual([1, 2, 3]);

    queue.done();
    await consumer;
  });
});

describe("AsyncQueue.clear", () => {
  test("闸开着也能清空：返回被清掉的那些，顺序即原顺序", () => {
    const queue = new AsyncQueue([1, 2, 3]);

    expect(queue.clear()).toEqual([1, 2, 3]);
    expect(queue.size).toBe(0);
    expect(queue.snapshot()).toEqual([]);
  });

  test("输入闸关着也能清空，且不顺手把输入闸打开", () => {
    const queue = new AsyncQueue<number>([1, 2, 3]);
    queue.pauseInput();

    expect(queue.clear()).toEqual([1, 2, 3]);
    expect(queue.size).toBe(0);
    // 清空没碰输入闸：往后 push 照样抛
    expect(queue.isInputPaused).toBe(true);
    expect(() => queue.push(4)).toThrow(QueueInputPausedError);
  });

  test("输出闸关着也能清空 —— 清空不是取件，不走取件的门", () => {
    const queue = new AsyncQueue([1, 2, 3]);
    queue.pauseOutput();

    // 取件被闸挡住：一件都不给
    expect(queue.takeAll()).toEqual([]);
    expect(queue.size).toBe(3);

    // 清空不被挡住：闸关着也全清得掉
    expect(queue.clear()).toEqual([1, 2, 3]);
    expect(queue.size).toBe(0);
    // 清空也不碰闸：该关着还关着
    expect(queue.isOutputPaused).toBe(true);
  });

  test("清空不碰 isDone", () => {
    const queue = new AsyncQueue([1, 2]);

    expect(queue.isDone).toBe(false);
    queue.clear();
    // 清的是存量，不是「以后还有没有新货」
    expect(queue.isDone).toBe(false);

    queue.done();
    expect(queue.isDone).toBe(true);

    // done() 之后清空也不会把它翻回来
    queue.push(3);
    expect(queue.clear()).toEqual([3]);
    expect(queue.isDone).toBe(true);
  });

  test("清空不唤醒挂在输出闸上的迭代器", async () => {
    const queue = new AsyncQueue<number>([1, 2]);
    queue.pauseOutput();

    const taken: number[] = [];
    let finished = false;
    const consumer = (async () => {
      for await (const value of queue) taken.push(value);
      finished = true;
    })();

    await sleep(5);
    expect(taken).toEqual([]);

    expect(queue.clear()).toEqual([1, 2]);
    await sleep(5);

    // 没有货要交给谁：迭代器没被叫醒 —— 没退出、没拿到东西、闸还关着
    expect(finished).toBe(false);
    expect(taken).toEqual([]);
    expect(queue.isOutputPaused).toBe(true);

    // 闸开了它看到的是空队列：取不到东西，接着等（不因为我清过就收尾）
    queue.resumeOutput();
    await sleep(5);
    expect(taken).toEqual([]);
    expect(finished).toBe(false);

    queue.done();
    await consumer;
    expect(finished).toBe(true);
    expect(taken).toEqual([]);
  });

  test("空队列清空返回 []（幂等）", () => {
    const queue = new AsyncQueue<number>();

    expect(queue.clear()).toEqual([]);
    expect(queue.clear()).toEqual([]);
    expect(queue.size).toBe(0);
  });

  test("清空后照常能收能取（闸开着时）", () => {
    const queue = new AsyncQueue([1, 2]);

    expect(queue.clear()).toEqual([1, 2]);

    queue.push(3, 4);
    expect(queue.size).toBe(2);
    expect(queue.takeAll()).toEqual([3, 4]);
    expect(queue.size).toBe(0);
  });

  test("清空放行 backpressure 的等待者（腾出空间是生产侧的信号，不是交货）", async () => {
    const queue = new AsyncQueue([1, 2, 3, 4, 5]);
    let released = false;

    const waiter = queue.backpressure(4).then(() => {
      released = true;
    });

    await sleep(5);
    expect(released).toBe(false);

    queue.clear();
    await waiter;

    expect(released).toBe(true);
    expect(queue.size).toBe(0);
  });
});
