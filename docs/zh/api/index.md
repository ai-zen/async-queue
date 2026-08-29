---
title: API 参考
description: AsyncQueue 的公开 API 说明：构造、push、shift、done、size、backpressure、isDone 与 Symbol.asyncIterator。
outline: deep
---

# API 参考

`AsyncQueue<T>` 是默认导出类，以下为公开接口。

## `new AsyncQueue<T>(iterable?)`

- 类型：`constructor(iterable?: Iterable<T> | null | undefined)`
- 说明：创建队列。若传入可迭代对象，会将其元素依次入队。
- 示例：

```ts
const queue = new AsyncQueue([1, 2, 3]);
const empty = new AsyncQueue<number>();
```

## `queue.push(...values: T[])`

- 说明：向队尾添加一个或多个值，并增加 `size`。会唤醒正在等待的消费者。
- 示例：

```ts
queue.push(1);
queue.push(2, 3);
queue.push(...values);
```

## `queue.shift()`

- 类型：`shift(): T | null`
- 说明：从队首取出并返回一个元素。队列为空时返回 `null`（底层 `LinkedQueue.shift` 在空队时返回 `null`，故类型为 `T | null`）。在 `for-await-of` 内部由异步迭代器调用；如需手动调用，请仅在 `size > 0` 时使用。
- 示例：

```ts
const a = queue.shift();
```

## `queue.done()`

- 说明：标记队列为完成，设置 `isDone = true`，并唤醒等待中的消费者。消费循环会在队列排空后结束。之后不应再 `push` 新值。
- 示例：

```ts
queue.done();
```

## `queue.size`

- 类型：`get size(): number`
- 说明：队列当前元素数量。
- 示例：

```ts
const n = queue.size;
```

## `queue.backpressure(max: number)`

- 类型：`backpressure(max: number): Promise<void>`
- 说明：当 `size >= max` 时进入等待，直到 `size < max`（即产生了一个 `shift` 腾出空间）才 resolve。适合在 `push` 前调用，以限制队列长度。
- 示例：

```ts
await queue.backpressure(10); // 队列长度 >= 10 时等待
queue.push(value);
```

## `queue.isDone`

- 类型：`boolean`
- 说明：`done()` 被调用后为 `true`。可在消费逻辑中判断队列是否已标记完成。
- 示例：

```ts
if (queue.isDone) {
  // 已标记完成
}
```

## `queue[Symbol.asyncIterator]()`

- 说明：返回异步生成器，供 `for-await-of` 使用。队列有值则立即产出；为空且未 `done` 时等待新值；为空且已 `done` 时结束。支持多个并发消费者（竞争消费者模式），每个值只会被其中一个消费者获得。
- 示例：

```ts
for await (const value of queue) {
  // 消费 value
}
```

## 说明

- 类型定义位于 `dist/esm/index.d.ts`。
- 源码见仓库内 `src/AsyncQueue.ts` 与 `src/LinkedQueue.ts`（见源码核实）。
- 若对某些行为（如 `shift()` 空队时的返回、`backpressure` 的等待语义）有疑问，请以 `src/` 下实现为准。
