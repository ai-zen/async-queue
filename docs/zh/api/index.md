---
title: API 参考
description: AsyncQueue 的公开 API 说明：构造、push、shift、takeAll、asTakeAll、snapshot、done、size、backpressure、isDone、Symbol.asyncIterator，以及输入/输出闸（pauseInput、resumeInput、isInputPaused、pauseOutput、resumeOutput、isOutputPaused）、clear 与 QueueInputPausedError 错误类。
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

## `queue.pauseInput()`

- 类型：`pauseInput(): void`
- 说明：关上输入闸 —— 「暂不收」。此后每次 `push()` 都抛 `QueueInputPausedError`，**一个都不入队**（一次 push 多个值时要么全收、要么一个都不收：不静默丢，也不偷偷缓冲）。不影响取件：队列里已有的货照旧能取。幂等，且与输出闸互不影响。
- 示例：

```ts
queue.pauseInput();
```

## `queue.resumeInput()`

- 类型：`resumeInput(): void`
- 说明：重新打开输入闸，`push()` 恢复正常。幂等。
- 示例：

```ts
queue.resumeInput();
```

## `queue.isInputPaused`

- 类型：`get isInputPaused(): boolean`
- 说明：输入闸当前是否关着（只读现读）。
- 示例：

```ts
if (queue.isInputPaused) {
  // 此时 push() 会抛 QueueInputPausedError
}
```

## `queue.shift()`

- 类型：`shift(): T | null`
- 说明：从队首取出并返回一个元素。队列为空时返回 `null`（底层 `LinkedQueue.shift` 在空队时返回 `null`，故类型为 `T | null`）。在 `for-await-of` 内部由异步迭代器调用；如需手动调用，请仅在 `size > 0` 时使用。
- 示例：

```ts
const a = queue.shift();
```

## `queue.takeAll(filterCallback?)`

- 类型：`takeAll(filterCallback?: (value: T) => boolean): T[]`
- 说明：**同步、不等待**，取走此刻队列里所有匹配的元素并按原顺序返回。不匹配的元素留在队列里、顺序不变；一条都不匹配就返回空数组。不传回调则取干全部。与 `shift()` 一样会放行 `backpressure()` 的等待者。它是**取件**，不是**清空**：输出闸关着（`pauseOutput()`）时它回 `[]`、一件都不取，`size` 也不变 —— 那只是暂时不给，货还排在队列里。要把存量作废请用 `clear()`。
- 示例：

```ts
const all = queue.takeAll();
const high = queue.takeAll((item) => item.priority === "high");
```

## `queue.clear()`

- 类型：`clear(): T[]`
- 说明：**作废**：把队列里的货全部取出丢弃，并按原顺序返回被清掉的那些。它和 `takeAll()` 的区别在于「不是取件」，于是有三条：**两道闸都不看**（输入关着、输出关着都照样清得掉）、**不唤醒任何消费者**（停在闸上的迭代器仍停在闸上，没人被交货）、**不碰 `isDone`**（清完队列照常能收能取）。空队列清空回 `[]`。要「取出来用」请用 `takeAll()`，要「作废」才用 `clear()`。
- 示例：

```ts
const discarded = queue.clear();
```

## `queue.asTakeAll()`

- 类型：`asTakeAll(): AsyncGenerator<T[], void, unknown>`
- 说明：`takeAll()` 的等待版视图。队列空时挂起；有货时**一次取干**并产出一批；**永不产出空数组**；`done()` 之后把剩下的吐完再结束。同一时刻只该有一个迭代器活着（多个迭代器会互相吞值）。输出闸关着时它和 `[Symbol.asyncIterator]()` 一样停在闸上：不会空转着吐空批，闸一开就一次取干。
- 示例：

```ts
for await (const batch of queue.asTakeAll()) {
  // batch 一定非空
}
```

## `queue.pauseOutput()`

- 类型：`pauseOutput(): void`
- 说明：关上输出闸 —— 「暂不取」。`takeAll()` 回 `[]`；`for await` / `asTakeAll()` 的消费者停在闸上等放行，而不是取件。`push()` 照收照排队（输入闸归 `pauseInput()` 管，两者互不影响）。幂等。
- 示例：

```ts
queue.pauseOutput();
```

## `queue.resumeOutput()`

- 类型：`resumeOutput(): void`
- 说明：打开输出闸，一次放行所有停在闸上的消费者，它们按原顺序接着取。幂等 —— 闸本来就开着时什么都不做（不去动闸上那个 promise，免得把「下一次关闸」的等待者提前放掉）。
- 示例：

```ts
queue.resumeOutput();
```

## `queue.isOutputPaused`

- 类型：`get isOutputPaused(): boolean`
- 说明：输出闸当前是否关着（只读现读）。
- 示例：

```ts
if (queue.isOutputPaused) {
  // 此时 takeAll() 会回 []
}
```

## `queue.snapshot()`

- 类型：`snapshot(): T[]`
- 说明：按原顺序把**此刻**队列里的元素抄成数组，**一个都不取走**。数组是拷贝，元素本身还是那一个（不会过期）。它是变更通知（`push` / `takeAll`）的诚实搭档：通知会丢，重读不会。
- 示例：

```ts
const items = queue.snapshot();
```

## `queue.done()`

- 说明：宣告「以后没有新货了」，并置 `isDone = true`。它是**信号，不是开关**：
  - 高于输入闸 —— 输入关着也照样置 `isDone`（`pauseInput()` 只拦 `push()`）；
  - **不突破输出闸** —— 输出关着时闸上的消费者继续等：不被唤醒、不退出、不取件，存量原样留在队列里，`resumeOutput()` 之后取完存量才见 `isDone` 收尾。

  不在输出闸后的等待者会被唤醒，消费循环在队列排空后结束。之后不应再 `push` 新值。
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

- 说明：返回异步生成器，供 `for-await-of` 使用。队列有值则立即产出；为空且未 `done` 时等待新值；为空且已 `done` 时结束。输出闸关着（`pauseOutput()`）时它停在闸上：队列里堆着货也一件都不取，`done()` 也不能把它叫醒 —— `resumeOutput()` 之后取完存量，才见 `isDone` 收尾。支持多个并发消费者（竞争消费者模式），每个值只会被其中一个消费者获得。
- 示例：

```ts
for await (const value of queue) {
  // 消费 value
}
```

## `QueueInputPausedError`

- 类型：`class QueueInputPausedError extends Error`（包的具名导出）
- 说明：输入闸关着时 `push()` 抛的错误。之所以具名导出而不是抛一个笼统的 `Error`：调用方得能在 `catch` 里分开两件事 —— 「输入暂时关了」（本错误，等 `resumeInput()` 就能继续送）与「队列已经结束了」（看 `isDone`，再等也不会有人来取）。
- 示例：

```ts
import AsyncQueue, { QueueInputPausedError } from "@ai-zen/async-queue";

try {
  queue.push(value);
} catch (error) {
  if (error instanceof QueueInputPausedError) {
    // 输入关着：这个值没入队
  }
}
```

## 说明

- 类型定义位于 `dist/index.d.ts`。
- 源码见仓库内 `src/AsyncQueue.ts` 与 `src/LinkedQueue.ts`（见源码核实）。
- 若对某些行为（如 `shift()` 空队时的返回、`backpressure` 的等待语义）有疑问，请以 `src/` 下实现为准。
