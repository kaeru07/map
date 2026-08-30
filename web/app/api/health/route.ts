/**
 * /api/health — DB 接続確認用エンドポイント
 *
 * レスポンス例:
 *   { ok: true,  mode: "live", packetCount: 1234, latency_ms: 42 }
 *   { ok: false, mode: "demo_no_config", error: "..." }
 *   { ok: false, mode: "demo_db_error",  error: "..." }
 */

import { isDemoMode, prisma } from "@/lib/db";

export async function GET() {
  // 環境変数チェック
  const hasDirect = !!process.env.DIRECT_URL;
  const hasDb     = !!process.env.DATABASE_URL;

  if (isDemoMode()) {
    return Response.json({
      ok: false,
      mode: "demo_no_config",
      error: "DIRECT_URL と DATABASE_URL がどちらも未設定です",
      env: { DIRECT_URL: hasDirect ? "✓" : "✗", DATABASE_URL: hasDb ? "✓" : "✗" },
    }, { status: 503 });
  }

  const t0 = Date.now();
  try {
    const count = await prisma.packet.count();
    const latency = Date.now() - t0;
    console.log(`[health] DB OK  packets=${count}  latency=${latency}ms`);
    return Response.json({
      ok: true,
      mode: "live",
      packetCount: count,
      latency_ms: latency,
      env: { DIRECT_URL: hasDirect ? "✓" : "✗", DATABASE_URL: hasDb ? "✓" : "✗" },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const latency = Date.now() - t0;
    console.error(`[health] DB ERROR  latency=${latency}ms  error=${error}`);
    return Response.json({
      ok: false,
      mode: "demo_db_error",
      error,
      latency_ms: latency,
      env: { DIRECT_URL: hasDirect ? "✓" : "✗", DATABASE_URL: hasDb ? "✓" : "✗" },
    }, { status: 503 });
  }
}
