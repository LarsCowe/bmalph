import { readFile } from "node:fs/promises";
import { isEnoent } from "../utils/errors.js";

const TEMPLATE_PLACEHOLDERS: Record<string, string> = {
  "PROMPT.md": "[YOUR PROJECT NAME]",
  "AGENT.md": "pip install -r requirements.txt",
};

export async function isTemplateCustomized(
  filePath: string,
  templateName: string
): Promise<boolean> {
  const placeholder = TEMPLATE_PLACEHOLDERS[templateName];
  if (!placeholder) return false;

  try {
    const content = await readFile(filePath, "utf-8");
    return !content.includes(placeholder);
  } catch (err) {
    if (isEnoent(err)) return false;
    throw err;
  }
}
