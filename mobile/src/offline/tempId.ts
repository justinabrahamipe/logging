import { getJSON, setJSON } from "./storage";

const KEY = "grindconsole.offline.nextTempId";

export async function nextTempId(): Promise<number> {
  const current = (await getJSON<number>(KEY)) ?? -1;
  await setJSON(KEY, current - 1);
  return current;
}
