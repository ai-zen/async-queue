---
title: 快速开始
description: 安装 @ai-zen/async-queue 并上手 AsyncQueue：创建实例、入队、标记完成、异步消费与背压控制。
outline: deep
---

# 快速开始

本章介绍如何安装并使用 `@ai-zen/async-queue`。

## 安装

```bash
npm install @ai-zen/async-queue
# 或
pnpm add @ai-zen/async-queue
```

## 引入

```ts
import AsyncQueue from "@ai-zen/async-queue";
```

## 创建实例

传入一个可迭代对象即可初始填充队列：

```ts
const queue = new AsyncQueue([1, 2, 3]);
console.log(queue.size); // 3
```

不传参数则创建一个空队列：

```ts
const queue = new AsyncQueue<number>();
```

## 入队与标记完成

```ts
queue.push(value);              // 单个
queue.push(value1, value2);     // 多个
queue.push(...values);          // 展开数组
queue.done();                   // 标记不再有新值，消费者会在队列排空后结束
```

`push` 会增加队列的 `size`；`done` 把 `isDone` 置为 `true`，表示不会再新增元素。

## 消费队列

用 `for-await-of` 异步消费。队列为空但未 `done` 时会等待；为空且已 `done` 时循环结束。

```ts
for await (const value of queue) {
  // 消费 value
}
```

## 示例 1：单个消费者

```ts
const queue = new AsyncQueue();

(async () => {
  for (const value of [1, 2, 3, 4, 5]) {
    await sleep(1); // 模拟异步产生
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1); // 模拟异步处理
  console.log(value);
}
console.log("Done!");
```

输出：

```
1
2
3
4
5
Done!
```

## 示例 2：多个消费者（竞争消费者模式）

多个消费者共享同一个队列，每个值只会被其中一个消费者取走，适合限制并发操作数量。

```ts
const queue = new AsyncQueue<Task>(tasks);
queue.done();

const results: TaskResult[] = [];

await Promise.all(
  Array.from({ length: 10 }).map(async () => {
    for await (const task of queue) {
      try {
        const result = await download(task);
        results.push(result);
      } catch (error) {
        console.error("Task failed:", error);
      }
    }
  })
);
```

## 示例 3：背压控制

在 `push` 之前 `await queue.backpressure(max)`，当队列长度达到或超过 `max` 时它会等待，直到腾出空间。

```ts
const queue = new AsyncQueue<number>();

(async () => {
  for (const value of Array.from({ length: 100 }).map((_, i) => i)) {
    await queue.backpressure(10); // 队列长度 >= 10 时等待
    queue.push(value);
  }
  queue.done();
})();

for await (const value of queue) {
  await sleep(1000); // 模拟异步处理
  result.push(value);
}
```

## 参考

- [AsyncQueue 异步队列](./index.md) —— 概述与核心特性。
- [API 参考](./api/index.md) —— 完整方法说明。
