// Synthetic independent process with explicit +1000ms offset. No cloud facts.
process.send({ ready: true });
process.on("message", (m) => {
  if (m.type === "sample") {
    const t2 = Date.now() + 1000;
    process.send({ t2, t3: Date.now() + 1000 });
  }
});
