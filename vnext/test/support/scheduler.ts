/** Deterministic schedule selection; SQL safety assertions live in tests. */
export function shuffled<T>(seed:number,items:readonly T[]):T[] {
  let state=seed>>>0;const out=[...items];
  const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
  for(let n=out.length-1;n>0;n--){const i=next()%(n+1);[out[i],out[n]]=[out[n]!,out[i]!];}
  return out;
}
