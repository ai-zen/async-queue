# AsyncQueue

AsyncQueue is a TypeScript class that provides a simple asynchronous queue implementation. It implements the `Symbol.asyncIterator` interface, allowing it to be used in `for-await-of` loops. This enables one or multiple consumers to process items in the queue asynchronously.

## Installation

Install AsyncQueue using npm:

```
npm install @ai-zen/async-queue
```

## Usage

### Importing

```typescript
import AsyncQueue from "@ai-zen/async-queue";
```

### Creating an AsyncQueue Instance

```typescript
const queue = new AsyncQueue([1, 2, 3]);
```

### Pushing Values to the Queue

```typescript
queue.push(value);

// Or
queue.push(value1, value2, value3, ...);

// Or
queue.push(...values);
```

The `push` method adds one or more values to the queue, and increases its size.

### Marking the Queue as Done

```typescript
queue.done();
```

The `done` method announces that no more items will ever be added. It is a *signal*, not a switch:

- **It outranks the input gate**: `done()` sets `isDone` even while input is paused — `pauseInput()` only gates `push()`.
- **It does not break the output gate**: while output is paused, consumers parked on the gate keep waiting — they are not woken, not ended, and take nothing. The backlog stays where it is; after `resumeOutput()` they drain it and only then end on `isDone`.

### Iterating Over the Queue

```typescript
for await (const value of queue) {
  // Consume the value
}
```

The `for await...of` loop can be used to iterate over the items in the queue. This loop is asynchronous and will wait for each value to be available before consuming it.

### Getting the Size of the Queue

```typescript
const size = queue.size;
```

The `size` property returns the current size of the queue.


### Taking Everything at Once

```typescript
// Synchronous: take everything (or everything matching) that is there right now.
const all = queue.takeAll();
const high = queue.takeAll((item) => item.priority === "high");

// Asynchronous: wait until there is something, then take that whole batch.
for await (const batch of queue.asTakeAll()) {
  // batch is never empty
}
```

`takeAll(filterCallback?)` never waits. Items that do not match stay in the queue and keep their order; if nothing matches it returns an empty array.

`asTakeAll()` is the waiting version: it hangs while the queue is empty, takes everything in one go when something arrives, never yields an empty array, and drains whatever is left before it ends after `done()`.

Use one or the other, not both: they are two ways of asking the same question ("what is there now?" vs "wake me when there is something").

`takeAll()` is a *take*, not a *clear*: while the output gate is closed (`pauseOutput()`) it returns `[]` and takes nothing, and `size` does not change — the items are only being held back, and they are still queued. To throw the backlog away use `clear()` (below), which is not a take and is not gated.


### Peeking Without Taking

```typescript
const items = queue.snapshot(); // copy, in order; the queue is untouched
```

`snapshot()` answers "what is in there right now" without consuming anything. Use it whenever you build anything on top of the queue's change notifications: a notification can be missed, a re-read cannot.

### Pausing the Input

```typescript
queue.pauseInput();  // from now on push() throws QueueInputPausedError
queue.isInputPaused; // true
queue.resumeInput(); // push() works again
```

`pauseInput()` closes the input gate: every `push()` throws `QueueInputPausedError` and **nothing at all is enqueued** (a multi-value `push` is all-or-nothing — it does not silently drop values, and it does not buffer them behind your back). `resumeInput()` opens it again. `isInputPaused` reads the current state.

This is "do not accept new items for now", not "do not hand items out for now": whatever is already in the queue stays takeable, and the input gate is independent of the output gate. Both calls are idempotent.

### Pausing the Output

```typescript
queue.pauseOutput();   // takeAll() returns [], iterators park on the gate
queue.push(1, 2, 3);   // still accepted and queued
queue.isOutputPaused;  // true
queue.resumeOutput();  // parked consumers take it all, in order
```

`pauseOutput()` closes the output gate: `takeAll()` returns `[]` without taking anything, and `for await` / `asTakeAll()` consumers park on the gate instead of taking items. `push()` keeps accepting and queuing as usual. `resumeOutput()` releases every parked consumer at once, and they continue in the original order. `isOutputPaused` reads the current state.

Both calls are idempotent, and the two gates do not interfere: `pauseOutput()` never rejects a `push()`, `pauseInput()` never blocks a `takeAll()`.

### Clearing the Queue

```typescript
const discarded = queue.clear(); // take everything out and throw it away
```

`clear()` **discards** the backlog: it removes every element and returns them in their original order. It is not a take, and the difference matters:

- it ignores **both** gates — it works while input or output is paused;
- it wakes **no** consumer — nobody gets an item, and parked iterators stay parked;
- it does not touch `isDone` — the queue can still accept and hand out items afterwards.

Clearing an empty queue returns `[]`. To take items out for use, keep using `takeAll()`: asking a take to do a clear's job is exactly how "cannot clear while paused" happens.

### The `QueueInputPausedError` Class

```typescript
import AsyncQueue, { QueueInputPausedError } from "@ai-zen/async-queue";

try {
  queue.push(value);
} catch (error) {
  if (error instanceof QueueInputPausedError) {
    // input is paused: the value was not enqueued; retry after resumeInput()
  }
}
```

`push()` throws `QueueInputPausedError` while the input gate is closed. It is exported by name so that a `catch` can tell two situations apart: "input is temporarily closed" (this error — wait for `resumeInput()`) and "the queue is finished" (`isDone` — nobody will ever take it).

## Examples

### Example 1: Single Consumer

You can add data asynchronously while consuming data asynchronously.

```typescript
const queue = new AsyncQueue();

(async () => {
  for (const value of [1, 2, 3, 4, 5]) {
    await sleep(1); // Simulate asynchronous operations
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1); // Simulate asynchronous operations
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

### Example 2: Multiple Consumers

This is useful for limiting the number of concurrent operations, such as network requests.

```typescript
// Assume `Task` and `TaskResult` are types defined elsewhere in your code
const queue = new AsyncQueue<Task>(tasks);

queue.done();

const results: TaskResult[] = [];

// Start 10 concurrent consumers using the competing-consumers pattern
await Promise.all(
  Array.from({ length: 10 }).map(async () => {
    for await (const task of queue) {
      try {
        const result = await download(task); // Perform the task
        results.push(result);
      } catch (error) {
        console.error("Task failed:", error);
      }
    }
  })
);
```

### Example 3: Backpressure

The library provides a very simple backpressure control mechanism that can prevent the queue length from exceeding a threshold. Just call and wait for the `backpressure` method before `push`. If the queue reaches the threshold, the `backpressure` method will wait until the queue length decreases to have space.

```typescript
const queue = new AsyncQueue<number>();
const result: number[] = [];

(async () => {
  for (const value of Array.from({ length: 100 }).map((_, i) => i)) {
    await queue.backpressure(10); // Wait for the queue to have space, the maximum size is 10
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1000); // Simulate asynchronous operations
  result.push(value);
}
```

### Example 4: Pausing the Output

Deliveries keep being accepted while taking is paused; once taking resumes, they come out in the original order.

```typescript
const queue = new AsyncQueue<number>();

queue.pauseOutput();          // stop taking
queue.push(1, 2, 3);          // pushes are still accepted and queued
console.log(queue.size);      // 3
console.log(queue.takeAll()); // [] — the gate is closed, nothing is handed out

queue.resumeOutput();         // release the gate

for await (const value of queue) {
  console.log(value); // 1, 2, 3
  if (value === 3) queue.done();
}
```

`clear()` is the way to throw that backlog away instead of taking it — and it works even while the gate is closed.

## License

This package is licensed under the MIT License.
