// Formats a generated file the way `prettier --check .` expects it, so the
// generator's output and npm run check agree. Files Prettier has no parser for
// (scaffold.sh) come back unchanged.
import { format, getFileInfo, resolveConfig } from 'prettier';

export async function formatFor(path: string, content: string): Promise<string> {
  const info = await getFileInfo(path);
  if (info.ignored || info.inferredParser === null) return content;
  const options = (await resolveConfig(path)) ?? {};
  return format(content, { ...options, filepath: path });
}
