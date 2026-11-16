# 异步队列（AsyncQueue）

AsyncQueue 是一个 TypeScript 类，提供了一个简单的异步队列实现。它实现了 `Symbol.asyncIterator` 接口，允许其在 `for-await-of` 循环中使用。这使得一个或多个消费者可以异步地处理队列中的项目。

## 安装

使用 npm 安装 AsyncQueue：

```
npm install @ai-zen/async-queue
```

## 使用说明

### 引入

```typescript
import AsyncQueue from "@ai-zen/async-queue";
```

### 创建 AsyncQueue 实例

```typescript
const queue = new AsyncQueue([1, 2, 3]);
```

### 向队列中添加值

```typescript
queue.push(value);

// 或者
queue.push(value1, value2, value3, ...);

// 或者
queue.push(...values);
```

`push` 方法用于向队列中添加一个或多个值，并增加队列的大小。

### 标记队列完成

```typescript
queue.done();
```

`done` 方法用于标记队列已完成。这表明不会有更多的项目被添加到队列中。

### 遍历队列

```typescript
for await (const value of queue) {
  // 使用该值
}
```

可以使用 `for await...of` 循环来遍历队列中的项目。这个循环是异步的，并且会在消费每个值之前等待其可用。

### 获取队列的大小

```typescript
const size = queue.size;
```

`size` 属性返回队列的当前大小。


### 一次全部取出

```typescript
// 同步：取干此刻队列里所有（或所有匹配的）元素
const all = queue.takeAll();
const high = queue.takeAll((item) => item.priority === "high");

// 异步：等到有货，然后一次取干这一批
for await (const batch of queue.asTakeAll()) {
  // batch 永远不是空数组
}
```

`takeAll(filterCallback?)` 不等待。不匹配的元素留在队列里、顺序不变；一条都不匹配就返回空数组。

`asTakeAll()` 是等待版：队列空时挂起，有货时一次取干，永不吐空数组，`done()` 之后把剩下的吐完再结束。

两个只用其一：它们是同一个问题的两种问法（「此刻有什么」和「有货了叫我」）。


### 看一眼（不取走）

```typescript
const items = queue.snapshot(); // 按顺序拷贝一份，队列一个都不少
```

`snapshot()` 回答「此刻里面有什么」，且不消费任何东西。凡是要在队列的变更通知之上自己维护一份东西，都该用它兜底：通知会丢，重读不会。

## 示例

### 示例 1：单个消费者

你可以一边添加数据，一边消费数据。

```typescript
const queue = new AsyncQueue();

(async () => {
  for (const value of [1, 2, 3, 4, 5]) {
    await sleep(1); // 模拟异步操作
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1); // 模拟异步操作
  console.log(value);
}

console.log("Done!");
```

输出:

```
1
2
3
4
5
Done!
```

### 示例 2：多个消费者

这对于限制并发操作的数量（如网络请求）非常有用。

```typescript
// 假设 `Task` 和 `TaskResult` 是代码其他地方定义的类型
const queue = new AsyncQueue<Task>(tasks);

queue.done();

const results: TaskResult[] = [];

// 使用竞争消费者模式启动 10 个并发消费者
await Promise.all(
  Array.from({ length: 10 }).map(async () => {
    for await (const task of queue) {
      try {
        const result = await download(task); // 执行任务
        results.push(result);
      } catch (error) {
        console.error("任务失败:", error);
      }
    }
  })
);
```

### 示例 3：背压控制

该库提供了一个极其简单的背压控制机制，可以防止队列长度超过阈值。只需要在 `push` 之前调用并等待 `backpressure` 方法即可。如果队列达到阈值，则 `backpressure` 方法将进行等待，直到队列长度减少到有空间为止。

```typescript
const queue = new AsyncQueue<number>();
const result: number[] = [];

(async () => {
  for (const value of Array.from({ length: 100 }).map((_, i) => i)) {
    await queue.backpressure(10); // 如果队列长度大于或等于 10，则等待队列长度减少到有空间为止
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1000); // 模拟异步操作
  result.push(value);
}
```

## 许可证

此软件包在 MIT 许可证下发布。
