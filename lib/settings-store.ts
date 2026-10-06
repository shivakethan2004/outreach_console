import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

export type Settings = {
  daily_call_limit: number;
};

const DEFAULT_SETTINGS: Settings = {
  daily_call_limit: 30,
};

function ensureFileExists() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.writeFileSync(
      SETTINGS_PATH,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      "utf-8"
    );
  }
}

export function readSettings(): Settings {
  ensureFileExists();
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      daily_call_limit:
        Number(parsed.daily_call_limit) > 0
          ? Number(parsed.daily_call_limit)
          : DEFAULT_SETTINGS.daily_call_limit,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const current = readSettings();
  const updated = { ...current, ...patch };
  ensureFileExists();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
