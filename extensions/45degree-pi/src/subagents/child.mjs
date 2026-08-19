import { spawn } from "node:child_process";

const parent = Number(process.env.PI_45DEGREE_PARENT_PID);
const child = spawn("pi", process.argv.slice(2), { stdio: "inherit" });
const stop = (signal = "SIGTERM") => {
  if (!child.killed) child.kill(signal);
};
const watch = setInterval(() => {
  try { process.kill(parent, 0); }
  catch { stop(); }
}, 250);
watch.unref();
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop("SIGINT"));
child.once("close", (code) => process.exit(code ?? 1));
child.once("error", () => process.exit(1));
