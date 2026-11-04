const tasks=new Map<string,{workers:(()=>Promise<void>)[];servers:(()=>Promise<void>)[]}>();
export function registerCleanup(database:string,kind:'workers'|'servers',run:()=>Promise<void>):void {
  let entry=tasks.get(database);if(!entry){entry={workers:[],servers:[]};tasks.set(database,entry);}entry[kind].push(run);
}
export async function stopFixtureChildren(database:string):Promise<void> {
  const entry=tasks.get(database);tasks.delete(database);if(!entry)return;
  for(const run of [...entry.workers].reverse())await run();
  for(const run of [...entry.servers].reverse())await run();
}
