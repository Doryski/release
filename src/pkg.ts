import { readFile, writeFile } from "node:fs/promises";

export const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(file, "utf8")) as T;

export const writeJson = async (file: string, data: unknown) => {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

export const updateVersionFile = async (file: string, newVersion: string) => {
  const json = await readJson<Record<string, unknown>>(file);
  if (json.version === newVersion) return false;
  json.version = newVersion;
  await writeJson(file, json);
  return true;
};
