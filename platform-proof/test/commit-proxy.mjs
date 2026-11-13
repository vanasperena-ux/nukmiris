import net from "node:net";
import { endpoint } from "../src/protocol.mjs";

/** Real PostgreSQL wire faults, deliberately loopback-only. Auth/query buffers
 * are forwarded, never logged. This is a test fixture, not a runtime retry path.
 */
export async function commitProxy(target, mode) {
  endpoint(target);
  if (!["BEFORE_SERVER", "ACK_LOST", "ROLLBACK_TAG"].includes(mode))
    throw Error("unsupported_commit_fault");
  const sockets = new Set();
  let intercepted = 0;
  const server = net.createServer((client) => {
    const upstream = net.connect(target);
    let startup = true,
      front = Buffer.alloc(0),
      back = Buffer.alloc(0);
    for (const s of [client, upstream]) {
      sockets.add(s);
      s.on("error", () => {});
      s.on("close", () => sockets.delete(s));
    }
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("data", (bytes) => {
      front = Buffer.concat([front, bytes]);
      if (startup) {
        if (front.length < 4) return;
        const n = front.readInt32BE();
        if (n < 8 || n > 1048576) {
          close();
          return;
        }
        if (front.length < n) return;
        upstream.write(front.subarray(0, n));
        front = front.subarray(n);
        startup = false;
      }
      while (front.length >= 5) {
        const n = front.readInt32BE(1) + 1;
        if (n < 5 || n > 1048576) {
          close();
          return;
        }
        if (front.length < n) return;
        let frame = front.subarray(0, n);
        front = front.subarray(n);
        if (frame[0] === 81 && frame.subarray(5).toString() === "COMMIT\0") {
          if (mode === "BEFORE_SERVER") {
            intercepted++;
            close();
            return;
          }
          if (mode === "ROLLBACK_TAG") {
            intercepted++;
            const payload = Buffer.from("ROLLBACK\0");
            frame = Buffer.alloc(payload.length + 5);
            frame[0] = 81;
            frame.writeInt32BE(payload.length + 4, 1);
            payload.copy(frame, 5);
          }
        }
        upstream.write(frame);
      }
    });
    upstream.on("data", (bytes) => {
      back = Buffer.concat([back, bytes]);
      while (back.length >= 5) {
        const n = back.readInt32BE(1) + 1;
        if (n < 5 || n > 1048576) {
          close();
          return;
        }
        if (back.length < n) return;
        const frame = back.subarray(0, n);
        back = back.subarray(n);
        if (
          mode === "ACK_LOST" &&
          frame[0] === 67 &&
          frame.subarray(5).toString() === "COMMIT\0"
        ) {
          intercepted++;
          close();
          return;
        }
        client.write(frame);
      }
    });
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    port: server.address().port,
    get intercepted() {
      return intercepted;
    },
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}
