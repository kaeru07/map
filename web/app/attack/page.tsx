"use client";

import { useCallback, useEffect, useRef } from "react";
import { NodeSelector } from "@/components/NodeSelector";
import {
  useAttackStore,
  ATTACK_TYPES,
  INTENSITY_LABELS,
  Intensity,
} from "@/lib/stores/attackStore";
import { VIRTUAL_NODES } from "@/lib/nodes";

// ─── ターミナルシミュレーション ──────────────────────────────────────────────

function buildSimOutput(
  attackType: string,
  targetIp: string,
  attackerIp: string,
  port: string,
  intensity: Intensity
): string[] {
  const ts = () => new Date().toLocaleTimeString("ja-JP", { hour12: false });
  const lines: string[] = [];

  switch (attackType) {
    case "port-scan":
      lines.push(`[${ts()}] Starting port scan on ${targetIp}`);
      lines.push(`[${ts()}] Source: ${attackerIp} → Target: ${targetIp}`);
      lines.push(`[${ts()}] Port range: ${port || "1-1024"} | Intensity: ${intensity}`);
      lines.push("─".repeat(52));
      lines.push(`[${ts()}] PORT     STATE    SERVICE`);
      lines.push(`[${ts()}] 22/tcp   open     ssh`);
      lines.push(`[${ts()}] 51820/udp open    wireguard`);
      lines.push(`[${ts()}] 80/tcp   filtered http`);
      lines.push(`[${ts()}] 443/tcp  filtered https`);
      lines.push("─".repeat(52));
      lines.push(`[${ts()}] Scan complete. 4 results returned.`);
      break;
    case "ping-flood":
      lines.push(`[${ts()}] Starting ICMP flood → ${targetIp}`);
      lines.push(`[${ts()}] Intensity: ${intensity}`);
      lines.push("─".repeat(52));
      for (let i = 1; i <= 6; i++) {
        lines.push(
          `[${ts()}] 64 bytes from ${targetIp}: icmp_seq=${i} ttl=64 time=${(Math.random() * 3 + 0.5).toFixed(2)} ms`
        );
      }
      lines.push(`[${ts()}] Packets sent: 2048 | Dropped: 0`);
      break;
    case "http-flood":
      lines.push(`[${ts()}] Starting HTTP flood → ${targetIp}:${port || "80"}`);
      lines.push(`[${ts()}] Intensity: ${intensity}`);
      lines.push("─".repeat(52));
      const codes = ["200 OK", "200 OK", "200 OK", "503 Service Unavailable", "504 Gateway Timeout"];
      for (let i = 0; i < 5; i++) {
        lines.push(
          `[${ts()}] GET http://${targetIp}:${port || "80"}/ → ${codes[i]}`
        );
      }
      lines.push(`[${ts()}] Requests: 1024 | Errors: 128`);
      break;
    case "syn-flood":
      lines.push(`[${ts()}] Starting TCP SYN flood → ${targetIp}:${port || "443"}`);
      lines.push(`[${ts()}] Intensity: ${intensity}`);
      lines.push("─".repeat(52));
      lines.push(`[${ts()}] Sending SYN packets (spoofed source IPs)...`);
      lines.push(`[${ts()}] Half-open connections: 512`);
      lines.push(`[${ts()}] Half-open connections: 1024`);
      lines.push(`[${ts()}] Half-open connections: 2048`);
      lines.push(`[${ts()}] Target backlog full — responses dropping`);
      break;
    default:
      lines.push(`[${ts()}] Unknown attack type: ${attackType}`);
  }

  return lines;
}

// ─── ページ ──────────────────────────────────────────────────────────────────

export default function AttackConsolePage() {
  const {
    attacker,
    target,
    attackType,
    config,
    isRunning,
    output,
    setTarget,
    setAttackType,
    setConfig,
    startAttack,
    stopAttack,
    appendOutput,
    clearOutput,
  } = useAttackStore();

  const terminalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 選択中の攻撃タイプ定義
  const currentAttackDef = ATTACK_TYPES.find((a) => a.id === attackType)!;

  // ターミナル自動スクロール
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  // 攻撃シミュレーション実行
  const runSimulation = useCallback(() => {
    const lines = buildSimOutput(
      attackType,
      target.ip,
      attacker.ip,
      config.port,
      config.intensity
    );

    let i = 0;
    function addLine() {
      if (i < lines.length) {
        appendOutput(lines[i]);
        i++;
        timerRef.current = setTimeout(addLine, 120);
      } else {
        stopAttack();
      }
    }
    addLine();
  }, [attackType, target.ip, attacker.ip, config.port, config.intensity, appendOutput, stopAttack]);

  const handleStart = useCallback(() => {
    if (isRunning) return;
    startAttack();
    appendOutput(`\n${"═".repeat(52)}`);
    appendOutput(`[ 攻撃開始: ${currentAttackDef.labelJa} ]`);
    appendOutput(`${"═".repeat(52)}`);
    runSimulation();
  }, [isRunning, startAttack, appendOutput, currentAttackDef.labelJa, runSimulation]);

  const handleStop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopAttack();
    appendOutput(`[STOP] 攻撃を中断しました`);
  }, [stopAttack, appendOutput]);

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* ページヘッダー */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
          攻撃コンソール
        </h1>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
            isRunning
              ? "border-red-700 bg-red-950 text-red-300"
              : "border-slate-600 bg-slate-800 text-slate-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isRunning ? "bg-red-400 animate-pulse" : "bg-slate-500"
            }`}
          />
          {isRunning ? "RUNNING" : "STANDBY"}
        </span>
      </div>

      {/* ── ノード選択パネル ──────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">ネットワーク構成</p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
          {/* 攻撃元（読み取り専用） */}
          <NodeSelector
            label="攻撃元"
            value={attacker}
            readonly
          />

          {/* 矢印 */}
          <div className="flex sm:flex-col items-center justify-center gap-1 text-slate-600">
            <span className="hidden sm:block text-xs text-slate-600">攻撃方向</span>
            <span className="text-xl sm:text-2xl text-red-700/60">→</span>
          </div>

          {/* 攻撃対象（ドロップダウン選択） */}
          <NodeSelector
            label="攻撃対象"
            value={target}
            onChange={setTarget}
            excludeId={attacker.id}
          />
        </div>

        {/* ノード一覧プレビュー */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
            仮想ネットワーク ({VIRTUAL_NODES.length} ノード)
          </p>
          <div className="flex flex-wrap gap-2">
            {VIRTUAL_NODES.map((n) => (
              <div
                key={n.id}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-mono transition-colors ${
                  n.id === attacker.id
                    ? "border-red-700/50 bg-red-950/30 text-red-400"
                    : n.id === target.id
                    ? "border-blue-700/50 bg-blue-950/30 text-blue-400"
                    : "border-slate-700 bg-slate-800/50 text-slate-500"
                }`}
              >
                <span className="text-[10px]">
                  {n.id === attacker.id ? "SRC" : n.id === target.id ? "DST" : "   "}
                </span>
                {n.ip}
                <span className="text-slate-600">({n.name})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 攻撃タイプ選択 ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">攻撃タイプ</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ATTACK_TYPES.map((at) => {
            const isSelected = attackType === at.id;
            return (
              <button
                key={at.id}
                onClick={() => !isRunning && setAttackType(at.id)}
                disabled={isRunning}
                className={`flex flex-col gap-1 rounded border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? at.color + " ring-1 ring-inset ring-current/40"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800"
                }`}
              >
                <span className="text-xs font-mono font-bold tracking-wide">{at.label}</span>
                <span className="text-[10px] text-current/70 leading-tight">{at.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 詳細設定 + 実行ボタン ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">設定</p>

        <div className="flex flex-wrap gap-3 items-end">
          {/* ポート（ping-flood は不要なので非表示） */}
          {attackType !== "ping-flood" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">
                ポート / 範囲
              </label>
              <input
                type="text"
                value={config.port}
                onChange={(e) => setConfig({ port: e.target.value })}
                disabled={isRunning}
                placeholder="例: 80 / 1-1024"
                className="w-28 rounded border border-slate-600 bg-slate-950 px-2.5 py-2 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          )}

          {/* 強度 */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">強度</label>
            <div className="relative">
              <select
                value={config.intensity}
                onChange={(e) => setConfig({ intensity: e.target.value as Intensity })}
                disabled={isRunning}
                className="appearance-none rounded border border-slate-600 bg-slate-950 pl-2.5 pr-7 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
              >
                {(Object.entries(INTENSITY_LABELS) as [Intensity, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">
                ▼
              </span>
            </div>
          </div>

          {/* 実行 / 停止ボタン */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded border border-red-700 bg-red-950 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900 active:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors min-h-[40px]"
            >
              {isRunning ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-red-500 border-t-red-200" />
              ) : (
                <span>▶</span>
              )}
              実行
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className="inline-flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px]"
            >
              ■ 停止
            </button>
            <button
              onClick={clearOutput}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px]"
              title="出力クリア"
            >
              🗑
            </button>
          </div>
        </div>
      </div>

      {/* ── ターミナル出力 ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
        {/* ターミナルヘッダー */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-slate-500 font-mono ml-1">
            攻撃出力 — {attacker.ip} → {target.ip}
          </span>
          <span className="ml-auto text-[10px] text-slate-600 font-mono">
            {output.filter(l => l.trim()).length} 行
          </span>
        </div>

        {/* ターミナル本体 */}
        <div
          ref={terminalRef}
          className="h-48 md:h-64 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
        >
          {output.length === 0 ? (
            <span className="text-slate-700">
              # 攻撃対象を選択して「実行」ボタンを押してください
            </span>
          ) : (
            output.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all ${
                  line.includes("═") || line.includes("─")
                    ? "text-slate-700"
                    : line.startsWith("[STOP]")
                    ? "text-yellow-400"
                    : line.includes("open")
                    ? "text-green-400"
                    : line.includes("filtered") || line.includes("Timeout") || line.includes("Unavailable")
                    ? "text-red-400"
                    : line.includes("[ 攻撃開始")
                    ? "text-cyan-400 font-bold"
                    : "text-slate-300"
                }`}
              >
                {line}
              </div>
            ))
          )}
          {/* カーソル */}
          {isRunning && (
            <span className="inline-block h-3 w-1.5 bg-green-400 animate-pulse ml-0.5" />
          )}
        </div>
      </div>

      {/* 注意書き */}
      <p className="text-[10px] text-slate-700 text-center">
        ※ 本コンソールは仮想環境内での教育目的シミュレーションです
      </p>
    </div>
  );
}
