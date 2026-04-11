import { create } from "zustand";
import { VirtualNode, ATTACKER_NODE, DEFAULT_TARGET_NODE } from "@/lib/nodes";

// ─── 攻撃タイプ ──────────────────────────────────────────────────────────────

export type AttackType = "port-scan" | "ping-flood" | "http-flood" | "syn-flood";

export interface AttackTypeConfig {
  id: AttackType;
  label: string;
  labelJa: string;
  description: string;
  defaultPort: string;
  color: string;
}

export const ATTACK_TYPES: AttackTypeConfig[] = [
  {
    id: "port-scan",
    label: "PORT SCAN",
    labelJa: "ポートスキャン",
    description: "対象ホストの開放ポートを列挙する",
    defaultPort: "1-1024",
    color: "border-cyan-700 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/60",
  },
  {
    id: "ping-flood",
    label: "PING FLOOD",
    labelJa: "Ping フラッド",
    description: "ICMP エコーリクエストを連続送信する",
    defaultPort: "",
    color: "border-yellow-700 bg-yellow-950/60 text-yellow-300 hover:bg-yellow-900/60",
  },
  {
    id: "http-flood",
    label: "HTTP FLOOD",
    labelJa: "HTTP フラッド",
    description: "HTTP GET リクエストを大量送信する",
    defaultPort: "80",
    color: "border-orange-700 bg-orange-950/60 text-orange-300 hover:bg-orange-900/60",
  },
  {
    id: "syn-flood",
    label: "SYN FLOOD",
    labelJa: "SYN フラッド",
    description: "TCP SYN パケットを送り続けリソースを枯渇させる",
    defaultPort: "443",
    color: "border-red-700 bg-red-950/60 text-red-300 hover:bg-red-900/60",
  },
];

// ─── 設定 ────────────────────────────────────────────────────────────────────

export type Intensity = "low" | "medium" | "high";

export const INTENSITY_LABELS: Record<Intensity, string> = {
  low: "低 (Low)",
  medium: "中 (Medium)",
  high: "高 (High)",
};

export interface AttackConfig {
  port: string;
  intensity: Intensity;
  durationSec: number;
}

// ─── ストア ──────────────────────────────────────────────────────────────────

export interface AttackStore {
  // ノード選択
  attacker: VirtualNode;
  target: VirtualNode;

  // 攻撃設定
  attackType: AttackType;
  config: AttackConfig;

  // 実行状態
  isRunning: boolean;
  output: string[];

  // アクション
  setTarget: (node: VirtualNode) => void;
  setAttackType: (type: AttackType) => void;
  setConfig: (partial: Partial<AttackConfig>) => void;
  startAttack: () => void;
  stopAttack: () => void;
  appendOutput: (line: string) => void;
  clearOutput: () => void;
}

export const useAttackStore = create<AttackStore>((set) => ({
  attacker: ATTACKER_NODE,
  target: DEFAULT_TARGET_NODE,

  attackType: "port-scan",
  config: {
    port: "1-1024",
    intensity: "medium",
    durationSec: 10,
  },

  isRunning: false,
  output: [],

  setTarget: (node) => set({ target: node }),
  setAttackType: (type) => {
    const def = ATTACK_TYPES.find((a) => a.id === type);
    set((s) => ({
      attackType: type,
      config: {
        ...s.config,
        port: def?.defaultPort ?? s.config.port,
      },
    }));
  },
  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  startAttack: () => set({ isRunning: true }),
  stopAttack: () => set({ isRunning: false }),

  /** 最大 500 行まで保持 */
  appendOutput: (line) =>
    set((s) => ({ output: [...s.output.slice(-499), line] })),

  clearOutput: () => set({ output: [] }),
}));
