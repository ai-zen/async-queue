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
}
