# AsyncQueue

`AsyncQueue` is a class for asynchronous queues that allows you to process data in order. It implements the `Symbol.asyncIterator` interface, so it can be used in `for-await-of` loops.

## Installation

Using npm:

```
npm install @ai-zen/async-queue
```

Using yarn:

```
yarn add @ai-zen/async-queue
```

## Usage

```typescript
import AsyncQueue from "@ai-zen/async-queue";

// Create an instance of AsyncQueue
const queue = new AsyncQueue<number>();

// Push data into the queue
queue.push(1);
queue.push(2);
queue.push(3);

// Process the queue in a for-await-of loop
async function processQueue() {
  for await (const value of queue) {
    console.log(value);
  }
}

processQueue().catch((error) => {
  console.error("Error processing queue:", error);
});

// Call the done method when the queue processing is complete
queue.done();
```

## API

### `push(value: T): void`

Pushes a value into the queue.

- `value` - The value to push into the queue.

### `done(): void`

Indicates that the queue processing is complete and no more values will be pushed.

### `size: number`

Gets the current number of values in the queue.

## Exception Handling

If an error occurs while processing the queue, you can use a `try-catch` block to catch the exception. After catching the exception, you can call the `done` method to indicate that the queue processing is complete and ensure that no more values are pushed.

```typescript
async function processQueue() {
  try {
    for await (const value of queue) {
      // Process the data
    }
  } catch (error) {
    console.error("Error processing queue:", error);
  } finally {
    queue.done();
  }
}
```

Make sure to always handle exceptions while processing the queue to prevent the queue from being left in an incomplete state.

## License

MIT License
