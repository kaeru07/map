import { getVerifiedState } from "@/lib/capture-state";

export async function GET() {
  try {
    const state = getVerifiedState();
    return Response.json(state);
  } catch (e: unknown) {
    return Response.json(
      { error: "状態の取得に失敗しました", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
