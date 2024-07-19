# AsyncQueue

AsyncQueue is a TypeScript class that provides a simple asynchronous queue implementation. It implements the `Symbol.asyncIterator` interface, so it can be used in `for-await-of` loops. It allows items to be pushed into the queue and consumed by one or multiple consumers using an async iterator.

## Installation

```
npm install @ai-zen/async-queue
```

## Usage

### Importing

```javascript
import AsyncQueue from "@ai-zen/async-queue";
```

### Creating an AsyncQueue instance

```javascript
const queue = new AsyncQueue();
```

### Pushing values to the queue

```javascript
queue.push(value);
```

The `push` method adds a value to the queue. It increases the size of the queue by 1.

### Marking the queue as done

```javascript
queue.done();
```

The `done` method marks the queue as done. This means that no more items will be pushed into the queue.

### Iterating over the queue

```javascript
for await (const value of queue) {
  // Consume the value
}
```

The `for await...of` loop can be used to iterate over the items in the queue. This loop is async, which means it will wait for each value to be available before consuming it.

### Getting the size of the queue

```javascript
const size = queue.size;
```

The `size` property returns the current size of the queue.

## Examples

### Example 1: Single consumer

```javascript
const queue = new AsyncQueue<number>();
const values = [1, 2, 3, 4, 5];
const result: number[] = [];

const promise1 = (async () => {
  for (const value of values) {
    await sleep(1000); // Assuming to do something asynchronous
    queue.push(value);
  }
  queue.done();
})();

const promise2 = (async () => {
  for await (const value of queue) {
    await sleep(1000); // Assuming to do something asynchronous
    result.push(value);
  }
})();

await Promise.all([promise1, promise2]);
```

Output:

```
1
2
3
4
5
```

### Example 2: Multiple consumers

This is very useful for limiting the number of concurrent requests, functioning as a simple thread pool.

```javascript
const queue = new AsyncQueue<number>();
const values = [1, 2, 3, 4, 5];
const result: number[] = [];

const promise1 = (async () => {
  for (const value of values) {
    await sleep(1000); // Assuming to do something asynchronous
    queue.push(value);
  }
  queue.done();
})();

const promise2 = Promise.all(
  Array.from({ length: 3 }).map(async () => {
    for await (const value of queue) {
      await sleep(1000); // Assuming to do something asynchronous
      result.push(value);
    }
  })
);

await Promise.all([promise1, promise2]);
```

Output:

```
1
2
3
4
5
```

## License

This package is licensed under the MIT License.
