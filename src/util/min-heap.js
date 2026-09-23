// Stable priority queue for bounded path searches. Tie order preserves each
// caller's historical traversal order without sorting the frontier repeatedly.
export class MinHeap {
  constructor(score, newestFirst = false) {
    this.score = score;
    this.newestFirst = newestFirst;
    this.items = [];
    this.sequence = 0;
  }
  get length() {
    return this.items.length;
  }
  before(a, b) {
    return (
      a.score < b.score ||
      (a.score === b.score && (this.newestFirst ? a.order > b.order : a.order < b.order))
    );
  }
  push(value) {
    const node = { value, score: this.score(value), order: this.sequence++ },
      a = this.items;
    let i = a.length;
    a.push(node);
    while (i) {
      const parent = (i - 1) >> 1;
      if (!this.before(node, a[parent])) break;
      a[i] = a[parent];
      i = parent;
    }
    a[i] = node;
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop();
    if (!first) return undefined;
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let child = i * 2 + 1;
        if (child + 1 < a.length && this.before(a[child + 1], a[child])) child++;
        if (!this.before(a[child], last)) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = last;
    }
    return first.value;
  }
}
