import type { ServiceCategory } from "./categories";

export type { ServiceCategory };

// ─── パケット ─────────────────────────────────────────────────────────────────

export type Packet = {
  id: string;
  timestamp: string; // ISO string
  srcIp: string;
  dstIp: string;
  srcPort: number | null;
  dstPort: number | null;
  protocol: string;
  bytes: number | null;
  direction: string | null;
  hostName: string | null;
  tlsSni: string | null;
  dnsQuery: string | null;
  rawJson: unknown;
  createdAt: string;
  updatedAt?: string;
  // ── v2 拡張フィールド ─────────────────────────────────────────────────────
  iface?: string | null;       // キャプチャ インターフェース
  dnsType?: string | null;     // DNS クエリ種別 (A, AAAA, HTTPS ...)
  dnsResp?: string | null;     // DNS レスポンス (カンマ区切り IP)
  tlsVersion?: string | null;  // TLS バージョン
  httpMethod?: string | null;  // HTTP メソッド
  httpPath?: string | null;    // HTTP リクエストパス
  // ── v3 拡張フィールド ─────────────────────────────────────────────────────
  transportProto?: string | null; // TCP / UDP / ICMP / SCTP
  tcpFlags?: string | null;       // TCP フラグ文字列 (SYN, ACK, ...)
  udpLength?: number | null;      // UDP データグラム長
  tlsCipher?: string | null;      // TLS 暗号スイート名
  tlsHandshake?: string | null;   // TLS ハンドシェイク種別 (ClientHello, ...)
  httpStatus?: number | null;     // HTTP レスポンスステータス
  ipTtl?: number | null;          // IP TTL
  ipLen?: number | null;          // IP データグラム長
  captureSession?: string | null; // キャプチャセッション ID
  // ── v4 拡張フィールド ─────────────────────────────────────────────────────
  relativeTime?: number | null;    // セッション開始からの相対時刻 [秒]
  tcpSyn?: boolean | null;         // TCP SYN フラグ
  tcpFin?: boolean | null;         // TCP FIN フラグ
  tcpRst?: boolean | null;         // TCP RST フラグ
  isQuicCandidate?: boolean | null;// QUIC 候補 (UDP + port 443)
  quicFlowId?: string | null;      // QUIC フロー識別子
  tlsSessionId?: string | null;    // TLS セッション ID
  flowId?: string | null;          // 簡易フロー ID (5秒ウィンドウ)
};

export type PacketFilters = {
  protocol?: string;
  srcIp?: string;
  dstIp?: string;
  dstPort?: string;
  timeFrom?: string;
  timeTo?: string;
  search?: string;
};

export type PacketsResponse = {
  packets: Packet[];
  total: number;
  page: number;
  pageSize: number;
  demo?: boolean;
  /** "no_db_config" = 環境変数未設定 / "db_error" = DB 接続失敗 */
  demoReason?: "no_db_config" | "db_error";
  demoError?: string;
};

export type StatsResponse = {
  total: number;
  protocols: string[];
  latestTimestamp: string | null;
  demo?: boolean;
};

// ─── VPN ────────────────────────────────────────────────────────────────────

export type VpnClient = {
  /** WireGuard インターフェース名 (例: wg0) */
  interface: string;
  /** VPN IP (例: 10.0.0.2) */
  ip: string;
  /** 表示名 (例: iPhone) */
  name: string;
  /** エンドポイント (例: 114.48.193.198:61293) or null */
  endpoint: string | null;
  /** ハンドシェイク表示 (例: 5 秒前) */
  handshake: string;
  /** ハンドシェイク Unix タイムスタンプ */
  handshakeTs: number;
  /** 受信量 (人間可読) */
  rx: string;
  /** 送信量 (人間可読) */
  tx: string;
  /** 直近 3 分以内にハンドシェイクがあれば true */
  connected: boolean;
};

export type VpnStatusResponse = {
  clients: VpnClient[];
  error?: string;
};

// ─── VPN ヘルパー ────────────────────────────────────────────────────────────

/** srcIp / dstIp が VPN クライアント IP かどうか判定 */
export function isVpnIp(ip: string): boolean {
  return ip.startsWith("10.0.0.") && ip !== "10.0.0.1";
}

/** VPN IP から表示名を返す (既知の IP のみ) */
export const VPN_CLIENT_NAMES: Record<string, string> = {
  "10.0.0.2": "iPhone",
};

export const PROTOCOL_COLORS: Record<string, string> = {
  TCP: "text-blue-400",
  UDP: "text-green-400",
  DNS: "text-yellow-400",
  TLS: "text-purple-400",
  HTTP: "text-orange-400",
  HTTPS: "text-orange-500",
  ICMP: "text-gray-400",
  ARP: "text-pink-400",
};

export type InfoItem = { value: string; count: number };

export type ItemsData = {
  generatedAt: string;
  /** hostName（tlsSni || httpHost || dnsQuery の優先順） */
  domains: InfoItem[];
  snIs: InfoItem[];
  dnsQueries: InfoItem[];
  dstIPs: InfoItem[];
  protocols: InfoItem[];
  dstPorts: InfoItem[];
  demo?: boolean;
};

export type AnalysisData = {
  generatedAt: string;
  summary: {
    total: number;
    uniqueIPs: number;
    uniqueDomains: number;
  };
  topDomains: { domain: string; count: number }[];
  protocols: { protocol: string; count: number }[];
  vpn: {
    iPhonePackets: number;
    vpnPackets: number;
  };
  recentDomains: string[];
  demo?: boolean;
};

// ─── 操作推定 ─────────────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";

/** 単一操作推定 */
export type OperationHint = {
  likelyAction: string;       // 「動画視聴っぽい」など
  representativeDomain: string | null;
  serviceCategory: ServiceCategory;
  confidence: Confidence;
  timestamp: string;          // ISO
  evidence: string;           // 推定根拠の説明
};

/** タイムラインイベント（1分バケットに集約） */
export type ActionEvent = {
  time: string;               // HH:MM 表示用
  timestamp: string;          // ISO（バケット先頭）
  action: string;
  category: ServiceCategory;
  domain: string | null;
  confidence: Confidence;
};

/** サービスカテゴリ別サマリー */
export type ServiceSummary = {
  category: ServiceCategory;
  count: number;
  bytes: number;
  topDomains: string[];
};

/** 通信量ランキング */
export type BytesRanking = {
  domain: string;
  bytes: number;
  count: number;
  serviceCategory: ServiceCategory;
};

/** DNS → 後続通信の関連付け */
export type DnsCorrelation = {
  dnsQuery: string;
  dnsTimestamp: string;       // ISO
  dnsResponseIps: string[];
  followups: Array<{
    timestamp: string;        // ISO
    dstIp: string;
    protocol: string;
    bytes: number | null;
    domain: string | null;
    serviceCategory: ServiceCategory;
  }>;
};

/** 通信フロー（同相手・同ポート・近い時間のパケットをまとめたもの） */
export type TrafficFlow = {
  id: string;
  representativeDomain: string | null;
  serviceCategory: ServiceCategory;
  dstIp: string;
  dstPort: number | null;
  protocol: string;
  packetCount: number;
  totalBytes: number;
  firstSeen: string;          // ISO
  lastSeen: string;           // ISO
  direction: string | null;
  likelyAction: string | null;
};

// ─── セッション解析 (Phase 5) ─────────────────────────────────────────────────

/** セッションタグ */
export type SessionTag =
  | "suspicious"    // 不審な接続 (RST without SYN など)
  | "longSession"   // 長時間セッション (> 60s)
  | "manyPackets"   // 大量パケット (> 50)
  | "unusualPort";  // 非標準ポート

/** QUIC フロー */
export type QuicFlow = {
  quicFlowId: string;
  srcIp: string;
  dstIp: string;
  dstPort: number | null;
  packetCount: number;
  totalBytes: number;
  firstSeen: string;          // ISO
  lastSeen: string;           // ISO
  durationSecs: number;
  representativeDomain: string | null;
  serviceCategory: ServiceCategory;
  tags: SessionTag[];
};

/** TLS セッション */
export type TlsSession = {
  sessionKey: string;         // 一意キー (導出)
  tlsSessionId: string | null;// tls.handshake.session_id (DB値)
  srcIp: string;
  dstIp: string;
  dstPort: number | null;
  sni: string | null;
  tlsVersion: string | null;
  hasClientHello: boolean;
  serviceCategory: ServiceCategory;
  firstSeen: string;          // ISO
  lastSeen: string;           // ISO
  relativeStart: number | null;// captureSession 内の相対時刻 [秒]
  relativeEnd: number | null;
  packetCount: number;
  totalBytes: number;
  tags: SessionTag[];
};

/** TCP セッション (flowId ベース) */
export type TcpSession = {
  flowId: string;
  srcIp: string;
  dstIp: string;
  srcPort: number | null;
  dstPort: number | null;
  hasSyn: boolean;
  hasFin: boolean;
  hasRst: boolean;
  isComplete: boolean;        // SYN + FIN (正常終了)
  isReset: boolean;           // RST あり
  packetCount: number;
  totalBytes: number;
  firstSeen: string;          // ISO
  lastSeen: string;           // ISO
  durationSecs: number;
  representativeDomain: string | null;
  serviceCategory: ServiceCategory;
  tags: SessionTag[];
};

/** フロービュー (flowId 別集約) */
export type FlowView = {
  flowId: string;
  packetCount: number;
  totalBytes: number;
  firstSeen: string;          // ISO
  lastSeen: string;           // ISO
  durationSecs: number;
  srcIp: string;
  dstIp: string;
  dstPort: number | null;
  protocol: string;
  representativeDomain: string | null;
  serviceCategory: ServiceCategory;
  direction: string | null;
  tags: SessionTag[];
};

/** 強化済み分析データ（既存 ComprehensiveAnalysis に追記） */
export type EnrichedAnalysis = {
  totalBytes: number;
  serviceSummary: ServiceSummary[];
  bytesRanking: BytesRanking[];
  operationTimeline: ActionEvent[];
  dnsCorrelations: DnsCorrelation[];
  estimatedOperations: OperationHint[];
  flows: TrafficFlow[];
  // ── Phase 5 追加 ──────────────────────────────────────────────────────────
  quicFlows: QuicFlow[];
  tlsSessions: TlsSession[];
  tcpSessions: TcpSession[];
  flowViews: FlowView[];
};

// ─── フィルター適用済み統合解析結果 ──────────────────────────────────────────

/** フィルター適用済みの統合解析結果 */
export type ComprehensiveAnalysis = {
  generatedAt: string;
  filters: PacketFilters;
  summary: {
    total: number;
    uniqueIPs: number;
    uniqueDomains: number;
  };
  topDomains: { domain: string; count: number }[];
  protocols: { protocol: string; count: number }[];
  vpn: {
    iPhonePackets: number;
    vpnPackets: number;
  };
  recentDomains: string[];
  items: {
    domains: InfoItem[];
    snIs: InfoItem[];
    dnsQueries: InfoItem[];
    dstIPs: InfoItem[];
    protocols: InfoItem[];
    dstPorts: InfoItem[];
    /** サービスカテゴリ別件数 */
    serviceCategories: InfoItem[];
    /** 代表ドメイン別件数 */
    representativeDomains: InfoItem[];
  };
  /** 操作推定・フロー解析（新規追加） */
  enriched?: EnrichedAnalysis;
  demo?: boolean;
};

export const PROTOCOL_BG: Record<string, string> = {
  TCP: "bg-blue-400/10 text-blue-300 border-blue-400/30",
  UDP: "bg-green-400/10 text-green-300 border-green-400/30",
  DNS: "bg-yellow-400/10 text-yellow-300 border-yellow-400/30",
  TLS: "bg-purple-400/10 text-purple-300 border-purple-400/30",
  HTTP: "bg-orange-400/10 text-orange-300 border-orange-400/30",
  HTTPS: "bg-orange-500/10 text-orange-200 border-orange-500/30",
  ICMP: "bg-gray-400/10 text-gray-300 border-gray-400/30",
  ARP: "bg-pink-400/10 text-pink-300 border-pink-400/30",
};
