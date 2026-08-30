import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { readState, writeState } from "@/lib/capture-state";

const execFileAsync = promisify(execFile);

// 実行コマンドは固定 — ユーザー入力は一切渡さない
const IMPORT_SCRIPT = "/root/map/scripts/import.sh";
const RAW_DIR = "/root/map/data/raw";
const WORK_DIR = "/root/map";

/** data/raw/ 配下で最新の capture_*.json または capture_*.pcap を返す */
function findLatestCaptureFile(): string | null {
  try {
    const entries = fs.readdirSync(RAW_DIR)
      .filter((f) => {
        if (!f.startsWith("capture_")) return false;
        return f.endsWith(".json") || f.endsWith(".pcap");
      })
      .map((f) => {
        const full = path.join(RAW_DIR, f);
        return { full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    return entries.length > 0 ? entries[0].full : null;
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const latestFile = findLatestCaptureFile();

    if (!latestFile) {
      return Response.json(
        {
          error: "インポート対象のキャプチャファイルが見つかりません",
          hint: "先にキャプチャを実行して data/raw/ に JSON ファイルを用意してください",
        },
        { status: 404 }
      );
    }

    // ファイルパスはシステムが決定 — 引数配列で渡すため shell injection なし
    const { stdout } = await execFileAsync("bash", [IMPORT_SCRIPT, latestFile], {
      cwd: WORK_DIR,
      timeout: 120_000, // 最大 2 分
    });

    const now = new Date().toISOString();
    const state = readState();
    writeState({
      ...state,
      lastImportedAt: now,
      lastMessage: `インポート完了: ${path.basename(latestFile)}`,
    });

    return Response.json({
      ok: true,
      file: path.basename(latestFile),
      importedAt: now,
      // 末尾 500 文字のみ返す (ログ過多防止)
      output: stdout.slice(-500).trim(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: "インポートに失敗しました", detail: msg.slice(0, 300) },
      { status: 500 }
    );
  }
}
