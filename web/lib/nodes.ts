// ─── 仮想ネットワークノード定義 ─────────────────────────────────────────────
// 将来ノードを追加する場合は VIRTUAL_NODES 配列に追記するだけでUIに反映される

export type NodeRole = "attacker" | "defender" | "server" | "honeypot";

export interface VirtualNode {
  id: string;
  name: string;
  ip: string;
  role: NodeRole;
  description?: string;
}

export const VIRTUAL_NODES: VirtualNode[] = [
  {
    id: "vps-defender",
    name: "VPS Defender",
    ip: "10.0.0.1",
    role: "defender",
    description: "防御側 VPS サーバー",
  },
  {
    id: "iphone-attacker",
    name: "iPhone Attacker",
    ip: "10.0.0.2",
    role: "attacker",
    description: "攻撃元 iPhone (WireGuard クライアント)",
  },
  // ── 将来追加予定 ───────────────────────────────────────────────────────────
  // { id: "web-server",  name: "Web Server", ip: "10.0.0.3", role: "server",   description: "HTTP/HTTPS サービス" },
  // { id: "db-server",   name: "DB Server",  ip: "10.0.0.4", role: "server",   description: "データベースサーバー" },
  // { id: "honeypot",    name: "Honeypot",   ip: "10.0.0.5", role: "honeypot", description: "おとりサーバー" },
];

/** ロールが "attacker" の最初のノードを攻撃元として使用 */
export const ATTACKER_NODE = VIRTUAL_NODES.find((n) => n.role === "attacker")!;

/** デフォルト攻撃対象: ロールが "defender" の最初のノード */
export const DEFAULT_TARGET_NODE = VIRTUAL_NODES.find((n) => n.role === "defender")!;

// ─── ロール別スタイル定義 ────────────────────────────────────────────────────

export const ROLE_ICON: Record<NodeRole, string> = {
  attacker: "⚔",
  defender: "🛡",
  server: "🖥",
  honeypot: "🪤",
};

export const ROLE_COLOR: Record<NodeRole, string> = {
  attacker: "text-red-400",
  defender: "text-blue-400",
  server: "text-green-400",
  honeypot: "text-yellow-400",
};

export const ROLE_BADGE: Record<NodeRole, string> = {
  attacker: "border-red-700 bg-red-950 text-red-300",
  defender: "border-blue-700 bg-blue-950 text-blue-300",
  server: "border-green-700 bg-green-950 text-green-300",
  honeypot: "border-yellow-700 bg-yellow-950 text-yellow-300",
};

export const ROLE_LABEL_JA: Record<NodeRole, string> = {
  attacker: "攻撃元",
  defender: "防御",
  server: "サーバー",
  honeypot: "ハニーポット",
};
