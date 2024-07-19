import AsyncQueue from "./AsyncQueue.js";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("AsyncQueue", () => {
  test("push should add value to the queue and increase size", () => {
    const queue = new AsyncQueue<number>();

    queue.push(1);
    expect(queue.size).toBe(1);

    queue.push(2);
    expect(queue.size).toBe(2);
  });

  test("done should mark the queue as done", () => {
    const queue = new AsyncQueue<number>();

    queue.done();
    expect(queue.isDone).toBe(true);
  });

  test("asyncIterator should iterate over the data queue", async () => {
    const queue = new AsyncQueue<number>();
    const values = [1, 2, 3, 4, 5];
    const result: number[] = [];

    const promise1 = (async () => {
      for (const value of values) {
        await sleep(1);
        queue.push(value);
      }
      queue.done();
    })();

    const promise2 = (async () => {
      for await (const value of queue) {
        await sleep(1);
        result.push(value);
      }
    })();

    await Promise.all([promise1, promise2]);

    expect(result).toEqual(values);
  });

  test("asyncIterator should allow multiple consumers", async () => {
    const queue = new AsyncQueue<number>();
    const values = [1, 2, 3, 4, 5];
    const result: number[] = [];

    const promise1 = (async () => {
      for (const value of values) {
        await sleep(1);
        queue.push(value);
      }
      queue.done();
    })();

    const promise2 = Promise.all(
      Array.from({ length: 3 }).map(async () => {
        for await (const value of queue) {
          await sleep(1);
          result.push(value);
        }
      })
    );

    await Promise.all([promise1, promise2]);

    expect(result).toEqual(values);
  });
});
