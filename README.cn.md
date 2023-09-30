# AsyncQueue

`AsyncQueue` 是一个异步队列类，它允许你按顺序异步处理数据。它实现了 `Symbol.asyncIterator` 接口，因此可以在 `for-await-of` 循环中使用。

## 安装

使用 npm：

```
npm install @ai-zen/async-queue
```

使用 yarn：

```
yarn add @ai-zen/async-queue
```

## 使用示例

```typescript
import AsyncQueue from "@ai-zen/async-queue";

// 创建一个 AsyncQueue 实例
const queue = new AsyncQueue<number>();

// 将数据推入队列
queue.push(1);
queue.push(2);
queue.push(3);

// 在 for-await-of 循环中处理数据
async function processQueue() {
  for await (const value of queue) {
    console.log(value);
  }
}

processQueue().catch((error) => {
  console.error("Error processing queue:", error);
});

// 当队列处理完成后调用 done 方法
queue.done();
```

## API

### `push(value: T): void`

将一个值推入队列。

- `value` - 要推入队列的值。

### `done(): void`

表示队列处理完成，不再有新的值推入。

### `size: number`

获取当前队列中的值数量。

## 异常处理

如果在处理队列时发生错误，可以使用 `try-catch` 块来捕获异常。在捕获到异常后，可以调用 `done` 方法来表示队列处理完成，以确保不再有新的值推入。

```typescript
async function processQueue() {
  try {
    for await (const value of queue) {
      // 处理数据
    }
  } catch (error) {
    console.error("Error processing queue:", error);
    queue.done();
  }
}
```

请确保在处理队列时始终处理异常，以免导致队列无法正常完成。

## 版权信息

MIT License
