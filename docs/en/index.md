---
title: AsyncQueue Async Queue
description: Core description of @ai-zen/async-queue: an async queue built on async iterators, supporting producer-consumer and competing-consumers patterns, with simple backpressure control.
outline: deep
---

# AsyncQueue Async Queue

AsyncQueue is a TypeScript class that implements the `Symbol.asyncIterator` interface and can be consumed by a `for-await-of` loop. It solves the problem where "a producer asynchronously produces some values, and one or more consumers asynchronously consume them," often used to limit concurrency (e.g., network requests, task scheduling).

## Core Features

- **Async iteration**: implements `Symbol.asyncIterator`, so you can directly `for await (const v of queue)`.
- **Multiple consumers / competing-consumers pattern**: multiple consumers can share the same queue, and each value is only obtained by one of them, naturally supporting concurrency limiting.
- **Backpressure control**: provides a simple `backpressure(max)` method that can be awaited before enqueuing to prevent the queue length from exceeding a threshold.
- **Input / output gates**: `pauseInput()` makes `push()` throw `QueueInputPausedError` and enqueue nothing; `pauseOutput()` parks consumers while deliveries keep queuing and coming out in order once resumed; `clear()` discards the backlog and is stopped by neither gate. The two gates are idempotent and independent.
- **Zero dependencies**: backed by a self-implemented linked list (`LinkedQueue`), with no third-party runtime dependencies.

## Environment Requirements

- Node.js runtime (must support `Symbol.asyncIterator` and `for-await-of`, usable on Node 10+; the development environment is based on Node 20).
- The package is published in both ESM and CJS formats, with built-in `.d.ts` type declarations, so TypeScript can be used directly.

## Installation

```bash
npm install @ai-zen/async-queue
# or
pnpm add @ai-zen/async-queue
```

## Quick Example

```ts
import AsyncQueue from "@ai-zen/async-queue";

const queue = new AsyncQueue<number>();

(async () => {
  for (const v of [1, 2, 3]) {
    queue.push(v);
  }
  queue.done();
})();

for await (const v of queue) {
  console.log(v); // 1 2 3
}
```

For more complete usage, see [Quick Start](./getting-started.md) and [API Reference](./api/index.md).

## Reference

- [Quick Start](./getting-started.md) — installation, creating instances, single/multiple consumer examples, backpressure example.
- [API Reference](./api/index.md) — `constructor`, `push`, `shift`, `takeAll`, `asTakeAll`, `snapshot`, `done`, `pauseInput` / `resumeInput` / `pauseOutput` / `resumeOutput`, `clear`, `size`, `backpressure`, `QueueInputPausedError`, etc.
