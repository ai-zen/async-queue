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

`done` 方法宣告「以后没有新货了」。它是个*信号*，不是开关：

- **高于输入闸**：输入关着也照样置 `isDone` —— `pauseInput()` 只拦 `push()`。
- **不突破输出闸**：输出关着时，停在闸上的消费者继续等 —— 不被唤醒、不退出、不取件，存量原样留在队列里；`resumeOutput()` 之后取完存量，才见 `isDone` 收尾。

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

`takeAll()` 是*取件*，不是*清空*：输出闸关着（`pauseOutput()`）时它回 `[]`、一件都不取，`size` 也不变 —— 那只是「暂时不给」，货还排在队列里。要把存量作废请用 `clear()`（见下），它不看闸，也不是取件。


### 看一眼（不取走）

```typescript
const items = queue.snapshot(); // 按顺序拷贝一份，队列一个都不少
```

`snapshot()` 回答「此刻里面有什么」，且不消费任何东西。凡是要在队列的变更通知之上自己维护一份东西，都该用它兜底：通知会丢，重读不会。

### 暂停输入

```typescript
queue.pauseInput();  // 此后 push() 抛 QueueInputPausedError
queue.isInputPaused; // true
queue.resumeInput(); // push() 恢复正常
```

`pauseInput()` 关上输入闸：此后每次 `push()` 都抛 `QueueInputPausedError`，**一个都不入队**（一次 push 多个值时要么全收、要么一个都不收 —— 不静默丢，也不在背后偷偷缓冲）。`resumeInput()` 重新打开。`isInputPaused` 读当前状态。

这是「暂不收」，不是「暂不取」：队列里已有的货照旧能取，输入闸与输出闸互不影响。两个方法都幂等。

### 暂停输出

```typescript
queue.pauseOutput();   // takeAll() 回 []，迭代器停在闸上
queue.push(1, 2, 3);   // 照收照排队
queue.isOutputPaused;  // true
queue.resumeOutput();  // 放行，闸上的消费者按原顺序取走
```

`pauseOutput()` 关上输出闸：`takeAll()` 回 `[]`、一件都不取，`for await` / `asTakeAll()` 的消费者停在闸上等放行而不是取件。`push()` 照收照排队。`resumeOutput()` 一次放行所有停在闸上的消费者，它们按原顺序接着取。`isOutputPaused` 读当前状态。

两个方法都幂等，两道闸也互不影响：`pauseOutput()` 不会让 `push()` 抛错，`pauseInput()` 也不会挡住 `takeAll()`。

### 清空队列（作废）

```typescript
const discarded = queue.clear(); // 全部取出并丢弃
```

`clear()` 是**作废**：把队列里的货全部取出丢弃，按原顺序返回被清掉的那些。它不是取件，差别正在这三条：

- **两道闸都不看** —— 输入关着、输出关着，都照样清得掉；
- **不唤醒任何消费者** —— 没有货要交给谁，停在闸上的迭代器仍停在闸上；
- **不碰 `isDone`** —— 清完队列照常能收能取。

空队列清空回 `[]`。要「取出来用」还请继续用 `takeAll()`：拿取件去干作废的活，就会遇到「暂停中清不掉」。

### `QueueInputPausedError` 错误类

```typescript
import AsyncQueue, { QueueInputPausedError } from "@ai-zen/async-queue";

try {
  queue.push(value);
} catch (error) {
  if (error instanceof QueueInputPausedError) {
    // 输入关着：这个值没入队，等 resumeInput() 之后再送
  }
}
```

输入闸关着时 `push()` 抛的就是 `QueueInputPausedError`。之所以具名导出：`catch` 里得能分辨「输入暂时关了」（本错误 —— 等 `resumeInput()` 就能继续送）和「队列已经结束了」（看 `isDone` —— 再等也不会有人来取）。

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

### 示例 4：暂停取件与恢复

暂停取件期间投递照收，恢复取件后按原顺序取出。

```typescript
const queue = new AsyncQueue<number>();

queue.pauseOutput();          // 暂停取件
queue.push(1, 2, 3);          // 投递照收、照排队
console.log(queue.size);      // 3
console.log(queue.takeAll()); // [] —— 闸关着，一件都不给

queue.resumeOutput();         // 放行

for await (const value of queue) {
  console.log(value); // 1、2、3
  if (value === 3) queue.done();
}
```

要把这批存量直接作废（而不是取走），用 `clear()` —— 闸关着也清得掉。

## 许可证

此软件包在 MIT 许可证下发布。
