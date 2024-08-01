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

The `done` method marks the queue as finished. This indicates that no more items will be added to the queue.

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

## License

This package is licensed under the MIT License.
