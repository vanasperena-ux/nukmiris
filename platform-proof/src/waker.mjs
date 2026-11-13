// Independent sibling: the suspended gateway cannot schedule its own wake-up.
import { readFile } from "node:fs/promises";
const { pid, startTime, delay } = JSON.parse(process.argv[2]);
setTimeout(async () => {
  try {
    const stat = await readFile("/proc/" + pid + "/stat", "utf8");
    const start = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
    if (start !== startTime) throw Error("pid_reused");
    process.kill(pid, "SIGCONT");
    process.send?.({ continued: true, pid, at: Date.now(), startTime });
  } catch {
    process.send?.({ continued: false, pid });
  } finally {
    process.disconnect?.();
  }
}, delay);
