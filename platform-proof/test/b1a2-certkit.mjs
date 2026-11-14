import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";
const run = promisify(execFile);
export async function certkit(dir) {
  await run(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-keyout",
      join(dir, "root.key"),
      "-out",
      join(dir, "root.pem"),
      "-subj",
      "/CN=B1a2 Synthetic Root",
    ],
    { timeout: 30000 },
  );
  const ca = await readFile(join(dir, "root.pem"), "utf8"),
    result = {};
  for (const role of ["server", "gateway", "observer", "unknown"]) {
    await run(
      "openssl",
      [
        "req",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        join(dir, role + ".key"),
        "-out",
        join(dir, role + ".csr"),
        "-subj",
        "/CN=" + role,
      ],
      { timeout: 30000 },
    );
    await writeFile(
      join(dir, role + ".ext"),
      "basicConstraints=critical,CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=" +
        (role === "server" ? "serverAuth" : "clientAuth") +
        "\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n",
    );
    await run(
      "openssl",
      [
        "x509",
        "-req",
        "-in",
        join(dir, role + ".csr"),
        "-CA",
        join(dir, "root.pem"),
        "-CAkey",
        join(dir, "root.key"),
        "-CAcreateserial",
        "-days",
        "1",
        "-out",
        join(dir, role + ".pem"),
        "-extfile",
        join(dir, role + ".ext"),
      ],
      { timeout: 30000 },
    );
    const cert = await readFile(join(dir, role + ".pem"), "utf8");
    result[role] = {
      key: await readFile(join(dir, role + ".key"), "utf8"),
      cert,
      ca,
      servername: "localhost",
      fingerprint: new X509Certificate(cert).fingerprint256,
    };
  }
  return result;
}
