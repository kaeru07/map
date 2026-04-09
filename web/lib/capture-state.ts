import fs from "fs";
import path from "path";

export const STATE_FILE = path.join("/root/map/data", "capture-state.json");

export interface CaptureState {
  running: boolean;
  pid: number | null;
  lastStartedAt: string | null;
  lastImportedAt: string | null;
  lastMessage: string | null;
}

const DEFAULT_STATE: CaptureState = {
  running: false,
  pid: null,
  lastStartedAt: null,
  lastImportedAt: null,
  lastMessage: null,
};

export function readState(): CaptureState {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(state: CaptureState): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 状態ファイルを読み、PIDが死んでいれば running=false に修正して返す */
export function getVerifiedState(): CaptureState {
  const state = readState();
  if (state.running && state.pid !== null) {
    if (!isProcessAlive(state.pid)) {
      state.running = false;
      state.pid = null;
      writeState(state);
    }
  }
  return state;
}
