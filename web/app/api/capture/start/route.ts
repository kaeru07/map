import { spawn } from "child_process";
import { getVerifiedState, writeState } from "@/lib/capture-state";

// 実行コマンドは固定 — ユーザー入力は一切使用しない
const CAPTURE_SCRIPT = "/root/map/scripts/capture.sh";
const WORK_DIR = "/root/map";

export async function POST() {
  try {
    const state = getVerifiedState();

    if (state.running) {
      return Response.json(
        { error: "すでにキャプチャが起動中です (PID: " + state.pid + ")", running: true },
        { status: 409 }
      );
    }

    // bash に固定引数として渡す — 文字列結合なし
    const child = spawn("bash", [CAPTURE_SCRIPT], {
      detached: true,
      stdio: "ignore",
      cwd: WORK_DIR,
    });

    if (child.pid === undefined) {
      throw new Error("プロセスの起動に失敗しました (PID が取得できませんでした)");
    }

    // 親プロセスから切り離して独立動作させる
    child.unref();

    const now = new Date().toISOString();
    writeState({
      running: true,
      pid: child.pid,
      lastStartedAt: now,
      lastImportedAt: state.lastImportedAt,
      lastMessage: "キャプチャを開始しました",
    });

    return Response.json({ ok: true, pid: child.pid, startedAt: now });
  } catch (e: unknown) {
    return Response.json(
      { error: "キャプチャの起動に失敗しました", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
