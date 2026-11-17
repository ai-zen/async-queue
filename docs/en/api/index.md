---
title: API Reference
description: Public API reference for AsyncQueue: constructor, push, shift, takeAll, asTakeAll, snapshot, done, size, backpressure, isDone, Symbol.asyncIterator, the input/output gates (pauseInput, resumeInput, isInputPaused, pauseOutput, resumeOutput, isOutputPaused), clear, and the QueueInputPausedError class.
outline: deep
---

# API Reference

`AsyncQueue<T>` is the default-exported class, with the following public interface.

## `new AsyncQueue<T>(iterable?)`

- Type: `constructor(iterable?: Iterable<T> | null | undefined)`
- Description: Creates a queue. If an iterable is passed, its elements are eagerly enqueued.
- Example:

```ts
const queue = new AsyncQueue([1, 2, 3]);
const empty = new AsyncQueue<number>();
```

## `queue.push(...values: T[])`

- Description: Adds one or more values to the tail of the queue and increases `size`. Wakes up any waiting consumers.
- Example:

```ts
queue.push(1);
queue.push(2, 3);
queue.push(...values);
```

## `queue.pauseInput()`

- Type: `pauseInput(): void`
- Description: Closes the input gate — "not accepting for now". From now on every `push()` throws `QueueInputPausedError` and **nothing at all is enqueued** (a multi-value `push` is all-or-nothing: no silent dropping, no hidden buffering). It does not affect taking: whatever is already queued stays takeable. Idempotent, and independent of the output gate.
- Example:

```ts
queue.pauseInput();
```

## `queue.resumeInput()`

- Type: `resumeInput(): void`
- Description: Opens the input gate again, so `push()` works as usual. Idempotent.
- Example:

```ts
queue.resumeInput();
```

## `queue.isInputPaused`

- Type: `get isInputPaused(): boolean`
- Description: Whether the input gate is currently closed. Read on every access.
- Example:

```ts
if (queue.isInputPaused) {
  // push() would throw QueueInputPausedError
}
```

## `queue.shift()`

- Type: `shift(): T | null`
- Description: Removes and returns an element from the head of the queue. Returns `null` when the queue is empty (the underlying `LinkedQueue.shift` returns `null` on an empty queue, so the type is `T | null`). In `for-await-of`, this is called internally by the async iterator; if called manually, only use it when `size > 0`.
- Example:

```ts
const a = queue.shift();
```

## `queue.takeAll(filterCallback?)`

- Type: `takeAll(filterCallback?: (value: T) => boolean): T[]`
- Description: **Synchronous, never waits.** Removes and returns, in their original order, every element that matches right now. Elements that do not match stay in the queue and keep their order; if nothing matches it returns an empty array. Without a callback it takes everything. Like `shift()`, it releases `backpressure()` waiters. It is a **take**, not a **clear**: while the output gate is closed (`pauseOutput()`) it returns `[]` and takes nothing, and `size` does not change — the items are only being held back and are still queued. To discard the backlog use `clear()`.
- Example:

```ts
const all = queue.takeAll();
const high = queue.takeAll((item) => item.priority === "high");
```

## `queue.clear()`

- Type: `clear(): T[]`
- Description: **Discards** the backlog: removes every element and returns the removed ones in their original order. Unlike `takeAll()` it is not a take, which means three things: it **ignores both gates** (it works while input or output is paused), it **wakes no consumer** (parked iterators stay parked, nobody is handed an item), and it **does not touch `isDone`** (the queue can still accept and hand out items afterwards). Clearing an empty queue returns `[]`. Use `takeAll()` when you want the items, `clear()` when you want them gone.
- Example:

```ts
const discarded = queue.clear();
```

## `queue.asTakeAll()`

- Type: `asTakeAll(): AsyncGenerator<T[], void, unknown>`
- Description: The waiting view of `takeAll()`. Hangs while the queue is empty; takes everything in one go and yields that batch once something is there; **never yields an empty array**; after `done()` it drains whatever is left and then ends. Only one iterator should be alive at a time (two of them would swallow each other's values). While the output gate is closed it parks on the gate, like `[Symbol.asyncIterator]()`: it does not spin on empty batches, and once the gate opens it takes everything in one go.
- Example:

```ts
for await (const batch of queue.asTakeAll()) {
  // batch is never empty
}
```

## `queue.pauseOutput()`

- Type: `pauseOutput(): void`
- Description: Closes the output gate — "not handing out for now". `takeAll()` returns `[]`, and `for await` / `asTakeAll()` consumers park on the gate instead of taking items. `push()` keeps accepting and queuing as usual (the input gate belongs to `pauseInput()`; the two do not affect each other). Idempotent.
- Example:

```ts
queue.pauseOutput();
```

## `queue.resumeOutput()`

- Type: `resumeOutput(): void`
- Description: Opens the output gate and releases every parked consumer at once; they continue in the original order. Idempotent — when the gate is already open it does nothing (it does not touch the gate's promise, so the waiters of a later `pauseOutput()` are not released early).
- Example:

```ts
queue.resumeOutput();
```

## `queue.isOutputPaused`

- Type: `get isOutputPaused(): boolean`
- Description: Whether the output gate is currently closed. Read on every access.
- Example:

```ts
if (queue.isOutputPaused) {
  // takeAll() would return []
}
```

## `queue.snapshot()`

- Type: `snapshot(): T[]`
- Description: Returns a copy of the current contents, in order, **without taking anything out**. The array is a copy; the elements themselves are the same objects, so they never go stale. This is the honest companion to change notifications (`push` / `takeAll`): a notification can be missed, a re-read cannot.
- Example:

```ts
const items = queue.snapshot();
```

## `queue.done()`

- Description: Announces that no more items will ever be added, and sets `isDone = true`. It is a **signal, not a switch**:
  - it outranks the input gate — `isDone` is set even while input is paused (`pauseInput()` only gates `push()`);
  - it does **not** break the output gate — while output is paused, parked consumers keep waiting: they are not woken, not ended, and take nothing; the backlog stays queued, and only after `resumeOutput()` do they drain it and end on `isDone`.

  Waiting consumers that are not behind the output gate wake up and the consuming loop ends once the queue is drained. Do not `push` new values afterward.
- Example:

```ts
queue.done();
```

## `queue.size`

- Type: `get size(): number`
- Description: The current number of elements in the queue.
- Example:

```ts
const n = queue.size;
```

## `queue.backpressure(max: number)`

- Type: `backpressure(max: number): Promise<void>`
- Description: When `size >= max`, it waits until `size < max` (i.e., a `shift` has freed up space) before resolving. Suitable for calling before `push` to limit the queue length.
- Example:

```ts
await queue.backpressure(10); // waits when queue length >= 10
queue.push(value);
```

## `queue.isDone`

- Type: `boolean`
- Description: `true` after `done()` is called. Can be used in consumption logic to determine whether the queue has been marked done.
- Example:

```ts
if (queue.isDone) {
  // already marked done
}
```

## `queue[Symbol.asyncIterator]()`

- Description: Returns an async generator for use with `for-await-of`. If the queue has values, it yields immediately; if empty and not `done`, it waits for new values; if empty and `done`, it ends. While the output gate is closed (`pauseOutput()`) it parks on the gate: it takes nothing even when items are queued, and `done()` does not wake it — after `resumeOutput()` it drains the backlog and only then ends on `isDone`. Supports multiple concurrent consumers (competing-consumers pattern), and each value is obtained by only one consumer.
- Example:

```ts
for await (const value of queue) {
  // consume value
}
```

## `QueueInputPausedError`

- Type: `class QueueInputPausedError extends Error` (named export of the package)
- Description: The error `push()` throws while the input gate is closed. It is exported by name — rather than thrown as a generic `Error` — so a `catch` can tell two situations apart: "input is temporarily closed" (this error; wait for `resumeInput()`) and "the queue is finished" (see `isDone`; nobody will ever take it).
- Example:

```ts
import AsyncQueue, { QueueInputPausedError } from "@ai-zen/async-queue";

try {
  queue.push(value);
} catch (error) {
  if (error instanceof QueueInputPausedError) {
    // input is paused: the value was not enqueued
  }
}
```

## Notes

- Type definitions are located in `dist/index.d.ts`.
- Source code is in `src/AsyncQueue.ts` and `src/LinkedQueue.ts` in the repository (see source for verification).
- If you have questions about certain behaviors (such as `shift()` returning on an empty queue, or the waiting semantics of `backpressure`), please refer to the implementation in `src/`.
