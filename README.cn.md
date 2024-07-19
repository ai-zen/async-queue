# AsyncQueue

AsyncQueue 是一个提供简单异步队列实现的 TypeScript 类。它实现了`Symbol.asyncIterator`接口，因此可以在`for-await-of`循环中使用。它允许将项目推入队列，并使用异步迭代器由一个或多个消费者消耗。

## 安装

```
npm install @ai-zen/async-queue
```

## 使用

### 导入

```javascript
import AsyncQueue from "@ai-zen/async-queue";
```

### 创建 AsyncQueue 实例

```javascript
const queue = new AsyncQueue();
```

### 推入值到队列中

```javascript
queue.push(value);
```

`push`方法将一个值添加到队列中。它会增加队列的大小 1。

### 将队列标记为完成

```javascript
queue.done();
```

`done`方法将队列标记为完成。这意味着将不再向队列中推入任何项目。

### 遍历队列

```javascript
for await (const value of queue) {
  // 消费值
}
```

`for await...of`循环可以用来遍历队列中的项目。这个循环是异步的，这意味着它将在使用每个值之前等待其可用。

### 获取队列的大小

```javascript
const size = queue.size;
```

`size`属性返回队列的当前大小。

## 示例

### 示例 1：单个消费者

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

输出：

```
1
2
3
4
5
```

### 示例 2：多个消费者

这对于限制并发请求的数量非常有用，就像一个简单的线程池一样。

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

输出：

```
1
2
3
4
5
```

## 许可证

该软件包根据 MIT 许可证进行许可。
