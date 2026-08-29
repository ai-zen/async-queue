---
title: AsyncQueue 异步队列
description: @ai-zen/async-queue 的核心说明：基于 async iterator 的异步队列，支持生产者-消费者与竞争消费者模式，并提供简易背压控制。
outline: deep
---

# AsyncQueue 异步队列

AsyncQueue 是一个 TypeScript 类，实现了 `Symbol.asyncIterator` 接口，可被 `for-await-of` 循环消费。它解决的是「生产者异步产生若干值，一个或多个消费者异步消费这些值」的问题，常用于限制并发数量（如网络请求、任务调度）。

## 核心特性

- **异步迭代**：实现 `Symbol.asyncIterator`，可直接 `for await (const v of queue)`。
- **多消费者 / 竞争消费者模式**：多个消费者可共享同一个队列，每个值只会被其中一个消费者拿到，天然支持并发限流。
- **背压控制**：提供简易的 `backpressure(max)` 方法，可在入队前等待，避免队列长度超过阈值。
- **零依赖**：底层用自实现的链表（`LinkedQueue`）存储，无第三方运行时依赖。

## 环境要求

- Node.js 运行时（需支持 `Symbol.asyncIterator` 与 `for-await-of`，Node 10+ 可用；开发环境基于 Node 20）。
- 包以 ESM + CJS 双格式发布，内置 `.d.ts` 类型声明，TypeScript 可直接使用。

## 安装

```bash
npm install @ai-zen/async-queue
# 或
pnpm add @ai-zen/async-queue
```

## 快速示例

```ts
import AsyncQueue from "@ai-zen/async-queue";

const queue = new AsyncQueue<number>();

(async () => {
  for (const v of [1, 2, 3]) {
    queue.push(v);
  }
  queue.done();
})();

for await (const v of queue) {
  console.log(v); // 1 2 3
}
```

更完整的用法见 [快速开始](./getting-started.md) 与 [API 参考](./api/index.md)。

## 参考

- [快速开始](./getting-started.md) —— 安装、创建实例、单/多消费者示例、背压示例。
- [API 参考](./api/index.md) —— `constructor`、`push`、`shift`、`done`、`size`、`backpressure` 等。
