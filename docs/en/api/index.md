---
title: API Reference
description: Public API reference for AsyncQueue: constructor, push, shift, takeAll, asTakeAll, done, size, backpressure, isDone, and Symbol.asyncIterator.
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

## `queue.shift()`

- Type: `shift(): T | null`
- Description: Removes and returns an element from the head of the queue. Returns `null` when the queue is empty (the underlying `LinkedQueue.shift` returns `null` on an empty queue, so the type is `T | null`). In `for-await-of`, this is called internally by the async iterator; if called manually, only use it when `size > 0`.
- Example:

```ts
const a = queue.shift();
```

## `queue.takeAll(filterCallback?)`

- Type: `takeAll(filterCallback?: (value: T) => boolean): T[]`
- Description: **Synchronous, never waits.** Removes and returns, in their original order, every element that matches right now. Elements that do not match stay in the queue and keep their order; if nothing matches it returns an empty array. Without a callback it takes everything. Like `shift()`, it releases `backpressure()` waiters.
- Example:

```ts
const all = queue.takeAll();
const high = queue.takeAll((item) => item.priority === "high");
```

## `queue.asTakeAll()`

- Type: `asTakeAll(): AsyncGenerator<T[], void, unknown>`
- Description: The waiting view of `takeAll()`. Hangs while the queue is empty; takes everything in one go and yields that batch once something is there; **never yields an empty array**; after `done()` it drains whatever is left and then ends. Only one iterator should be alive at a time (two of them would swallow each other's values).
- Example:

```ts
for await (const batch of queue.asTakeAll()) {
  // batch is never empty
}
```

## `queue.done()`

- Description: Marks the queue as done, sets `isDone = true`, and wakes up waiting consumers. The consuming loop ends after the queue is drained. Do not `push` new values afterward.
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

- Description: Returns an async generator for use with `for-await-of`. If the queue has values, it yields immediately; if empty and not `done`, it waits for new values; if empty and `done`, it ends. Supports multiple concurrent consumers (competing-consumers pattern), and each value is obtained by only one consumer.
- Example:

```ts
for await (const value of queue) {
  // consume value
}
```

## Notes

- Type definitions are located in `dist/index.d.ts`.
- Source code is in `src/AsyncQueue.ts` and `src/LinkedQueue.ts` in the repository (see source for verification).
- If you have questions about certain behaviors (such as `shift()` returning on an empty queue, or the waiting semantics of `backpressure`), please refer to the implementation in `src/`.
