# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [1.7.0-alpha.0] - 2026-11-17

The gates release. The queue used to have a single terminal signal (`done()`)
and a single way out (`takeAll()`), so "do not accept for now", "do not hand out
for now" and "throw the backlog away" all had to be expressed with the same two
tools — and "cannot clear while paused" was the result. They are now three
separate operations.

### Added

- `pauseInput()` / `resumeInput()` / `isInputPaused` — the **input gate**. While
  it is closed, `push()` throws `QueueInputPausedError` and **not a single item
  is enqueued**; a multi-value `push()` is all-or-nothing (values are neither
  silently dropped nor secretly buffered). Pausing only stops new items from
  coming in: whatever is already queued stays takeable.
- `pauseOutput()` / `resumeOutput()` / `isOutputPaused` — the **output gate**.
  While it is closed, `takeAll()` returns `[]` and takes nothing, `for await`
  and `asTakeAll()` park on the gate, and `push()` keeps accepting and queuing
  as usual. `resumeOutput()` releases every parked consumer at once and they
  continue in the original order.
- `clear(): T[]` — **discards** the backlog and returns the removed elements in
  their original order. It is a clear, not a take: it ignores **both** gates
  (it works while input or output is paused), wakes **no** consumer (parked
  iterators stay parked), and does not touch `isDone` (the queue can still
  accept and hand out items afterwards). Clearing an empty queue returns `[]`.
- `QueueInputPausedError` — exported by name from the package entry point so a
  `catch` can tell two situations apart: "input is temporarily closed" (this
  error — wait for `resumeInput()` and retry) and "the queue is finished"
  (`isDone` — nobody will ever take it).

### Changed

- `done()` — its semantics and implementation are **unchanged**; the
  documentation now states explicitly that it is a *signal*, not a switch. It
  outranks the input gate (it sets `isDone` even while input is paused, because
  `pauseInput()` only gates `push()`) and it **does not break the output gate**:
  while output is paused, consumers parked on the gate keep waiting — they are
  not woken, not ended, and take nothing; the backlog stays where it is, and
  after `resumeOutput()` they drain it and only then finish on `isDone`.
- `takeAll()` — behaviour unchanged; the documentation now states explicitly
  that it is a *take*, not a *clear*: while the output gate is closed it returns
  `[]` and takes nothing, and `size` does not change — the items are only being
  held back, they are still queued. Throwing the backlog away is `clear()`'s
  job, which is exactly how "cannot clear while paused" happens when a take is
  asked to do a clear's work.
- The two gates are independent and every pause/resume call is idempotent:
  `pauseOutput()` never rejects a `push()`, and `pauseInput()` never blocks a
  `takeAll()`.

### Compatibility

- **With none of the new methods called, behaviour is exactly the same as
  1.6.0.**
- The public surface only grows: the names and behaviour of `push`, `takeAll`,
  `shift`, `size`, `backpressure`, `asTakeAll`, `snapshot`, `done` and the async
  iterator are all unchanged.

### Notes

- `done()` is a signal about the future ("no more items will be added"), not a
  switch that flushes the present; `clear()` throws the present away and says
  nothing about the future; `pauseInput()` and `pauseOutput()` are temporary
  gates on the two directions, and neither one is `done()`. Keeping those three
  apart is the whole point of this release.

## [1.6.0] - 2026-11-16

### Added

- `AsyncQueue.snapshot(): T[]` — copies the current elements into an array in
  their original order, without taking a single one out (`f41716d`).
- `LinkedQueue.toArray()` — the underlying single-pass traversal that backs
  `snapshot()`.

### Changed

- Nothing existing changed. Callers that used to keep a mirror of the queue on
  top of the change notifications no longer have to: a missed notification used
  to diverge permanently from the real queue and there was no way to re-read and
  heal. "Notification + re-read at any time" is now enough.
- The returned array is a copy; the elements themselves are the same objects, so
  it never hands out stale entries.

### Notes

- Tests: 15 → 19 (including "does not touch the queue", "returns a copy",
  "reflects immediately after `takeAll()`", "empty after `done()` drains").

## [1.5.0] - 2026-11-16

### Added

- `AsyncQueue.takeAll(filterCallback?)` — synchronously drains every matching
  element that is there right now. Non-matching elements stay where they are and
  keep their order; if nothing matches it returns an empty array without
  waiting; like `shift()` it releases `backpressure()` waiters.
- `AsyncQueue.asTakeAll()` — the waiting view of `takeAll()`: it hangs while the
  queue is empty, takes everything in one go when something arrives, never
  yields an empty array, and drains whatever is left before ending after
  `done()`. Internally it is `takeAll()` behind a wait, so the two are not two
  implementations.
- `LinkedQueue.takeWhere(predicate)` — removes all matching nodes in a single
  pass by relinking pointers, keeps the rest in order, and retreats `tail` when
  the tail node itself is removed (otherwise a later `push` would attach behind
  a detached node).
- Documentation for both methods in the bilingual README and in
  `docs/{zh,en}/api`.

### Changed

- The build toolchain for the 1.4.0 release was restored into the repository
  (`rolldown.config.ts`, `tsconfig.json`, `vitest.config.ts` added;
  `jest.config.cjs` and `tsconfig.{cjs,esm}.json` removed; specs moved to
  vitest).
- The method is not called `filter`, to avoid colliding with the same-named
  TC39 async iterator helper, which means something different (a view, not a
  take).
- Tests: 6 → 15 (6 for `takeAll()`, 3 for `asTakeAll()`).

### Notes

- 1.4.0 was published to npm without a source commit landing in this repository
  (`origin/main` was still at 1.3.2). Its `src` was verified to be identical to
  1.3.2 and the rebuilt `dist` differs from the published package only in
  rolldown version comments, so there is no separate 1.4.0 entry in this file.

## [1.3.2] - 2025-02-23

### Added

- Package module exports and build scripts.

### Changed

- Release updated to v1.3.2 (`83fa20c`).

## [1.3.1] - 2024-10-09

### Added

- Backpressure support to `AsyncQueue` — wait on `backpressure(max)` before
  `push()` to keep the queue from growing past a threshold.

### Changed

- The array-based queue was replaced with a linked queue.

## [1.2.0] - 2024-07-30

### Changed

- Version bump recorded in the release commit (`e39ac39`); the commit message
  does not describe any further change.

## [1.1.1] - 2024-07-19

### Changed

- Version bump recorded in the release commit (`2905ee3`); the commit message
  does not describe any further change.

## [1.1.0] - 2024-07-19

### Changed

- Version bump recorded in the release commit (`2984604`); the commit message
  does not describe any further change.

## [1.0.3] - 2024-03-03

### Changed

- Version bump recorded in the release commit (`ee2742f`); the commit message
  does not describe any further change.

### Notes

- The commit `1a55488 fix: export default` (2023-11-01) falls between 1.0.1 and
  this release and carries no version number of its own, so it is recorded here.

## [1.0.1] - 2023-09-30

### Changed

- Version bump recorded in the release commit (`7845735`); the commit message
  does not describe any further change.

### Notes

- The initial commits (`3510c0a first commit`, `69b30df add typescript`, plus
  the repository and package naming updates of 2023-09-12) precede any version
  number mentioned in the commit history, so no dated 1.0.0 entry is claimed
  here.

[Unreleased]: https://github.com/ai-zen/async-queue/compare/v1.7.0-alpha.0...HEAD
[1.7.0-alpha.0]: https://github.com/ai-zen/async-queue/compare/v1.6.0...v1.7.0-alpha.0
[1.6.0]: https://github.com/ai-zen/async-queue/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/ai-zen/async-queue/compare/v1.3.2...v1.5.0
[1.3.2]: https://github.com/ai-zen/async-queue/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/ai-zen/async-queue/compare/v1.2.0...v1.3.1
[1.2.0]: https://github.com/ai-zen/async-queue/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/ai-zen/async-queue/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ai-zen/async-queue/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/ai-zen/async-queue/compare/v1.0.1...v1.0.3
[1.0.1]: https://github.com/ai-zen/async-queue/compare/3510c0a...v1.0.1
