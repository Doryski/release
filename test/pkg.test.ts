import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateVersionFile } from "../src/pkg.js";

describe("updateVersionFile", () => {
  let file: string;

  beforeEach(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "doryski-release-"));
    file = path.join(dir, "package.json");
    await writeFile(
      file,
      `${JSON.stringify({ name: "x", version: "1.0.0" }, null, 2)}\n`,
      "utf8",
    );
  });

  afterEach(() => {
    file = "";
  });

  it("writes the new version with a trailing newline", async () => {
    const changed = await updateVersionFile(file, "1.1.0");
    expect(changed).toBe(true);
    const raw = await readFile(file, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw).version).toBe("1.1.0");
  });

  it("does not write when already at the target version", async () => {
    const changed = await updateVersionFile(file, "1.0.0");
    expect(changed).toBe(false);
    const raw = await readFile(file, "utf8");
    expect(JSON.parse(raw).version).toBe("1.0.0");
  });
});
