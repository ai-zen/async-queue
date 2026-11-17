---
title: Quick Start
description: Install @ai-zen/async-queue and get started with AsyncQueue: creating an instance, pushing values, marking done, async consumption, and backpressure control.
outline: deep
---

# Quick Start

This chapter explains how to install and use `@ai-zen/async-queue`.

## Installation

```bash
npm install @ai-zen/async-queue
# or
pnpm add @ai-zen/async-queue
```

## Import

```ts
import AsyncQueue from "@ai-zen/async-queue";
```

## Creating an Instance

Pass an iterable to initialize the queue with values:

```ts
const queue = new AsyncQueue([1, 2, 3]);
console.log(queue.size); // 3
```

Pass no argument to create an empty queue:

```ts
const queue = new AsyncQueue<number>();
```

## Pushing Values and Marking Done

```ts
queue.push(value);              // single
queue.push(value1, value2);     // multiple
queue.push(...values);          // spread array
queue.done();                   // mark that no more values will come; consumers end after the queue is drained
```

`push` increases the queue's `size`; `done` sets `isDone` to `true`, indicating that no more items will be added.

## Consuming the Queue

Use `for-await-of` to consume asynchronously. When the queue is empty but not `done`, it waits; when empty and `done`, the loop ends.

```ts
for await (const value of queue) {
  // consume value
}
```

## Pausing and Resuming

Two independent, idempotent gates let you suspend one side without touching the other.

**Input gate** — "not accepting for now": `push()` throws `QueueInputPausedError` and enqueues nothing; the items already in the queue stay takeable.

```ts
queue.pauseInput();
queue.isInputPaused; // true
// queue.push(1) -> throws QueueInputPausedError, nothing is enqueued
queue.resumeInput(); // push() works again
```

**Output gate** — "not handing out for now": `takeAll()` returns `[]`, `for await` / `asTakeAll()` consumers park on the gate, while `push()` keeps accepting and queuing. `resumeOutput()` releases them all, and they continue in the original order.

```ts
queue.pauseOutput();
queue.push(1, 2, 3);   // accepted and queued
queue.takeAll();       // [] — the gate is closed
queue.resumeOutput();  // parked consumers take 1, 2, 3
```

`done()` is a signal, not a switch: it sets `isDone` even while input is paused, but it does not break the output gate — parked consumers keep waiting and only end after `resumeOutput()`, once the backlog is drained.

To discard the backlog instead of taking it, use `clear()`: it ignores both gates, wakes no consumer, leaves `isDone` alone, and returns the discarded items in their original order.

## Example 1: Single Consumer

```ts
const queue = new AsyncQueue();

(async () => {
  for (const value of [1, 2, 3, 4, 5]) {
    await sleep(1); // simulate async production
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1); // simulate async processing
  console.log(value);
}
console.log("Done!");
```

Output:

```
1
2
3
4
5
Done!
```

## Example 2: Multiple Consumers (Competing-Consumers Pattern)

Multiple consumers share the same queue, and each value is taken by only one consumer, which is suitable for limiting the number of concurrent operations.

```ts
const queue = new AsyncQueue<Task>(tasks);
queue.done();

const results: TaskResult[] = [];

await Promise.all(
  Array.from({ length: 10 }).map(async () => {
    for await (const task of queue) {
      try {
        const result = await download(task);
        results.push(result);
      } catch (error) {
        console.error("Task failed:", error);
      }
    }
  })
);
```

## Example 3: Backpressure Control

Before `push`, `await queue.backpressure(max)`; when the queue length reaches or exceeds `max`, it waits until space is available.

```ts
const queue = new AsyncQueue<number>();

(async () => {
  for (const value of Array.from({ length: 100 }).map((_, i) => i)) {
    await queue.backpressure(10); // wait when queue length >= 10
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1000); // simulate async processing
  result.push(value);
}
```

## Example 4: Pausing the Output

Deliveries keep being accepted while taking is paused; once taking resumes, they come out in the original order.

```ts
const queue = new AsyncQueue<number>();

queue.pauseOutput();          // stop taking
queue.push(1, 2, 3);          // still accepted and queued
console.log(queue.size);      // 3
console.log(queue.takeAll()); // [] — nothing is handed out

queue.resumeOutput();         // release the gate

for await (const value of queue) {
  console.log(value); // 1, 2, 3
  if (value === 3) queue.done();
}
```

## Reference

- [AsyncQueue Async Queue](./index.md) — overview and core features.
- [API Reference](./api/index.md) — complete method reference.
