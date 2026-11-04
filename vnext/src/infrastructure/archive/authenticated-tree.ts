import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import type { Ref } from './protocol.js';

interface Node { key: string; sequence: number; entry: string; left: Ref | null; right: Ref | null; height: number }
/** SQLite is an untrusted cache: every edge is checked against its parent hash. */
export class AuthenticatedTree {
  private readonly cache = new Map<string, Node>();
  private readonly dirty = new Set<string>();
  private readonly references = new WeakMap<Node,Ref>();
  private readonly get: StatementSync;
  private readonly put: StatementSync;
  reads = 0;
  constructor(db: DatabaseSync, table: 'nodes' | 'repair_nodes' = 'nodes') {
    this.get = db.prepare(`SELECT value FROM ${table} WHERE key=?`);
    this.put = db.prepare(`INSERT INTO ${table}(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  }
  private ref(n: Node): Ref {
    let ref=this.references.get(n);
    if(!ref) {
      const edge=(r:Ref|null)=>r?[r.key,r.hash,r.height]:null;
      const hash=createHash('sha256').update(JSON.stringify(['nukmiris-avl-v1',n.key,n.sequence,n.entry,edge(n.left),edge(n.right),n.height])).digest('hex');
      ref={key:n.key,hash,height:n.height};this.references.set(n,ref);
    }
    return ref;
  }
  private load(ref: Ref, rotating=false): Node {
    let n = this.cache.get(ref.key);
    if (!n) {
      const row = this.get.get(ref.key) as {value:string} | undefined; this.reads++;
      if (!row) throw new Error('archive_index_missing');
      n = JSON.parse(row.value) as Node; this.cache.set(ref.key,n);
    }
    if (n.key !== ref.key || n.height !== ref.height || this.ref(n).hash !== ref.hash ||
        n.height !== 1 + Math.max(n.left?.height ?? 0,n.right?.height ?? 0) ||
        (!rotating && Math.abs((n.left?.height ?? 0)-(n.right?.height ?? 0)) > 1) || n.height > 64 || n.height < 1)
      throw new Error('archive_index_invalid');
    return n;
  }
  find(root: Ref | null, key: string): {sequence:number;entry:string} | null {
    let lo = '', hi = 'g', steps = 0;
    for (let ref=root; ref;) {
      if (++steps > 64 || ref.key <= lo || ref.key >= hi) throw new Error('archive_index_order');
      const n = this.load(ref);
      if (key === n.key) return {sequence:n.sequence,entry:n.entry};
      if (key < n.key) { hi=n.key; ref=n.left; } else { lo=n.key; ref=n.right; }
    }
    return null; // Authenticated null edge, not an untrusted SQL "no rows".
  }
  private save(n: Node): Ref {
    n.height = 1 + Math.max(n.left?.height ?? 0,n.right?.height ?? 0);
    this.references.delete(n);
    this.cache.set(n.key,n); this.dirty.add(n.key); return this.ref(n);
  }
  private rotateRight(n: Node): Ref {
    const l={...this.load(n.left!,true)}; n.left=l.right; l.right=this.save(n); return this.save(l);
  }
  private rotateLeft(n: Node): Ref {
    const r={...this.load(n.right!,true)}; n.right=r.left; r.left=this.save(n); return this.save(r);
  }
  insert(root: Ref | null, key: string, sequence: number, entry: string, depth=0): Ref {
    if (depth>64) throw new Error('archive_index_depth');
    if (!root) return this.save({key,sequence,entry,left:null,right:null,height:1});
    const n={...this.load(root)};
    if(key===n.key) throw new Error('archive_duplicate_identity');
    if(key<n.key) n.left=this.insert(n.left,key,sequence,entry,depth+1);
    else n.right=this.insert(n.right,key,sequence,entry,depth+1);
    const balance=(n.left?.height??0)-(n.right?.height??0);
    if(balance>1) {
      if(key>n.left!.key) n.left=this.rotateLeft({...this.load(n.left!)});
      return this.rotateRight(n);
    }
    if(balance< -1) {
      if(key<n.right!.key) n.right=this.rotateRight({...this.load(n.right!)});
      return this.rotateLeft(n);
    }
    return this.save(n);
  }
  flush(): void {
    for(const key of this.dirty) this.put.run(key,JSON.stringify(this.cache.get(key)));
    this.dirty.clear(); this.cache.clear();
  }
}
