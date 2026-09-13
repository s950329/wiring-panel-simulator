/** Edges belonging to any simple path between two supplied nets.
 * Biconnected blocks avoid falsely classifying dangling load branches as series circuits.
 * Edge indices, rather than vertex pairs, preserve parallel loads.
 */
export function loadPaths(edges: readonly (readonly [string, string])[], pairs: readonly (readonly [string, string])[]): Set<number> {
  const adjacency = new Map<string, {to: string; edge: number}[]>();
  edges.forEach(([a, b], edge) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push({to: b, edge}); adjacency.get(b)!.push({to: a, edge});
  });
  const entered = new Map<string, number>(), low = new Map<string, number>(), stack: number[] = [], blocks: number[][] = [];
  let time = 0;
  function visit(v: string, parentEdge = -1) {
    entered.set(v, ++time); low.set(v, time);
    for (const {to, edge} of adjacency.get(v) ?? []) {
      if (edge === parentEdge) continue;
      if (!entered.has(to)) {
        stack.push(edge); visit(to, edge); low.set(v, Math.min(low.get(v)!, low.get(to)!));
        if (low.get(to)! >= entered.get(v)!) {
          const block: number[] = [];
          let popped: number;
          do {popped = stack.pop()!; block.push(popped);} while (popped !== edge);
          blocks.push(block);
        }
      } else if (entered.get(to)! < entered.get(v)!) {
        stack.push(edge); low.set(v, Math.min(low.get(v)!, entered.get(to)!));
      }
    }
  }
  for (const v of adjacency.keys()) if (!entered.has(v)) visit(v);
  const tree = new Map<string, string[]>(), blockIds = new Map<string, number[]>();
  const vertex = (s: string) => JSON.stringify(['net', s]);
  blocks.forEach((block, i) => {
    const id = JSON.stringify(['block', i]); blockIds.set(id, block); tree.set(id, []);
    for (const endpoint of new Set(block.flatMap(e => [...edges[e]]))) {
      const v = vertex(endpoint); if (!tree.has(v)) tree.set(v, []);
      tree.get(v)!.push(id); tree.get(id)!.push(v);
    }
  });
  const found = new Set<number>();
  for (const [a, b] of pairs) {
    const start = vertex(a), end = vertex(b), previous = new Map<string, string | null>([[start, null]]), queue = [start];
    for (let i = 0; i < queue.length && !previous.has(end); i++) {
      for (const v of tree.get(queue[i]) ?? []) if (!previous.has(v)) {previous.set(v, queue[i]); queue.push(v);}
    }
    if (!previous.has(end)) continue;
    let v: string | null = end;
    while (v !== null) {for (const e of blockIds.get(v) ?? []) found.add(e); v = previous.get(v)!;}
  }
  return found;
}
