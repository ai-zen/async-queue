import { describe, expect, test } from "vitest";
import AsyncQueue from "./AsyncQueue.js";

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
