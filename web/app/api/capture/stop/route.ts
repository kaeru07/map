import { getVerifiedState, writeState } from "@/lib/capture-state";

export async function POST() {
  try {
    const state = getVerifiedState();

    if (!state.running || state.pid === null) {
      // すでに停止中 — エラーにしない
      return Response.json({ ok: true, message: "すでに停止しています" });
    }

    const pid = state.pid;

    // プロセスグループごと停止 (detached spawn で作られた新グループを終了)
    // negative PID でプロセスグループ全体にシグナルを送る
    let killed = false;
    try {
      process.kill(-pid, "SIGTERM");
      killed = true;
    } catch {
      // プロセスグループへの送信が失敗した場合、直接 PID に送る
      try {
        process.kill(pid, "SIGTERM");
        killed = true;
      } catch {
        // プロセスはすでに終了していた
      }
    }

    writeState({
      ...state,
      running: false,
      pid: null,
      lastMessage: killed ? "キャプチャを停止しました" : "プロセスはすでに終了していました",
    });

    return Response.json({
      ok: true,
      message: killed ? "キャプチャを停止しました" : "プロセスはすでに終了していました",
    });
  } catch (e: unknown) {
    return Response.json(
      { error: "停止処理に失敗しました", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
