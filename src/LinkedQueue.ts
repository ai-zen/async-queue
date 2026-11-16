export class LinkNode<T> {
  value: T;
  next: LinkNode<T> | null;

  constructor(value: T) {
    this.value = value;
    this.next = null;
  }
}

export class LinkedQueue<T> {
  head: LinkNode<T> | null;
  tail: LinkNode<T> | null;

  private _size: number;
  public get size(): number {
    return this._size;
  }

  constructor() {
    this.head = null;
    this.tail = null;
    this._size = 0;
  }

  private _push(value: T) {
    const newNode = new LinkNode(value);
    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      this.tail!.next = newNode;
      this.tail = newNode;
    }
    this._size++;
  }

  push(...values: T[]) {
    for (const value of values) {
      this._push(value);
    }
  }

  shift() {
    if (!this.head) return null;
    const value = this.head.value;
    this.head = this.head.next;
    this._size--;
    return value;
  }

  /**
   * 从中间摘：摘掉所有匹配的节点，**其余保持原顺序**。
   *
   * 只有 push / shift 的时候，「取走一部分、剩下的不动」只能靠「全部 shift 出来再 push 回去」，
   * 那是两趟，而且顺序得调用方自己记。这里直接改链表指针，一趟就是。
   *
   * @returns 被摘掉的值，按它们原来的先后顺序
   */
  takeWhere(predicate: (value: T) => boolean): T[] {
    const taken: T[] = [];
    let prev: LinkNode<T> | null = null;
    let node = this.head;

    while (node) {
      const next = node.next;

      if (predicate(node.value)) {
        taken.push(node.value);
        if (prev) prev.next = next;
        else this.head = next;
        // 摘掉的若是尾节点，tail 得一起退 —— 否则它指着已摘下来的节点，下一次 push 会接到它后面
        if (node === this.tail) this.tail = prev;
        node.next = null;
        this._size--;
      } else {
        prev = node;
      }

      node = next;
    }

    return taken;
  }

  /**
   * 看一眼：按原顺序把当前所有值抄成数组，**不动队列**。
   *
   * 与 `takeWhere` 的区别是「读」与「取走」：这个是只读快照，队列一个都不少。
   */
  toArray(): T[] {
    const values: T[] = [];
    for (let node = this.head; node; node = node.next) values.push(node.value);
    return values;
  }
}
