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
