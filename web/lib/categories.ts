/**
 * categories.ts
 * ドメイン文字列ベースのサービス分類ルール（外部API不使用）。
 * ルールは正規表現配列で管理し、優先順に評価する。
 */

// ─── 型 ──────────────────────────────────────────────────────────────────────

export type ServiceCategory =
  | "Apple"
  | "Google"
  | "OpenAI"
  | "Twitch"
  | "LINE"
  | "Brave"
  | "Supabase"
  | "CDN"
  | "Tracking"
  | "Video"
  | "Unknown";

// ─── 分類ルール（優先順） ─────────────────────────────────────────────────────

const RULES: { category: ServiceCategory; patterns: RegExp[] }[] = [
  {
    category: "Apple",
    patterns: [
      /\.apple\.com$/,
      /\.icloud\.com$/,
      /\.mzstatic\.com$/,
      /\.apple-dns\.net$/,
      /apple-relay\./,
      /iphone-ld\./,
      /gspe\d+\.ls\.apple/,
      /bag\.itunes/,
      /ppq\.apple/,
      /push\.apple\.com/,
      /ocsp\.apple\.com/,
      /identity\.apple\.com/,
      /courier\.push\.apple\.com/,
      /ess\.apple\.com/,
      /time\.apple\.com/,
      /mesu\.apple\.com/,
      /xp\.apple\.com/,
      /gateway\.icloud\.com/,
      /p\d+-caldav\.icloud\.com/,
      /p\d+-contacts\.icloud\.com/,
      /configuration\.apple\.com/,
      /captive\.apple\.com/,
    ],
  },
  {
    category: "Google",
    patterns: [
      /\.google\.com$/,
      /\.googleapis\.com$/,
      /\.googlevideo\.com$/,
      /\.gstatic\.com$/,
      /\.google-analytics\.com$/,
      /\.youtube\.com$/,
      /\.ytimg\.com$/,
      /\.ggpht\.com$/,
      /\.doubleclick\.net$/,
      /\.googlesyndication\.com$/,
      /\.googleusercontent\.com$/,
      /\.firebase\.com$/,
      /\.firebaseapp\.com$/,
      /\.googletagmanager\.com$/,
      /youtubei\./,
    ],
  },
  {
    category: "OpenAI",
    patterns: [
      /\.openai\.com$/,
      /\.chatgpt\.com$/,
      /oaistatic\.com/,
      /oaiusercontent\.com/,
      /ab\.chatgpt\.com/,
      /ios\.chat\.openai/,
      /ws\.chatgpt\.com/,
    ],
  },
  {
    category: "Twitch",
    patterns: [
      /\.twitch\.tv$/,
      /\.twitchapps\.com$/,
      /spade\.twitch\.tv/,
      /gql\.twitch\.tv/,
      /irc\.chat\.twitch\.tv/,
      /video-weaver\./,
      /usher\.twitchlabs\.com/,
      /\.jtvnw\.net$/,
      /clips\.twitch\.tv/,
      /static\.twitchsvc\.net/,
    ],
  },
  {
    category: "LINE",
    patterns: [
      /\.line\.me$/,
      /\.naver\.com$/,
      /line-apps\.com/,
      /\.line-cdn\.net$/,
      /obs\.line-apps\.com/,
      /legy-.*\.line-apps\.com/,
      /gd\.line-apps\.com/,
    ],
  },
  {
    category: "Brave",
    patterns: [
      /\.brave\.com$/,
      /search\.brave\.com/,
      /go-updater\.brave\.com/,
      /laptop-updates\.brave\.com/,
      /p3a\.brave\.com/,
      /star-randsrv\.bsg\.brave\.com/,
    ],
  },
  {
    category: "Supabase",
    patterns: [
      /\.supabase\.co$/,
      /\.supabase\.io$/,
      /supabase\.com/,
    ],
  },
  {
    category: "CDN",
    patterns: [
      /\.cloudfront\.net$/,
      /\.fastly\.net$/,
      /\.fastlylb\.net$/,
      /\.cloudflare\.com$/,
      /\.akamaiedge\.net$/,
      /\.akamai\.net$/,
      /\.edgekey\.net$/,
      /\.cdn77\.org$/,
      /\.azureedge\.net$/,
      /\.jsdelivr\.net$/,
      /\.unpkg\.com$/,
      /\.b-cdn\.net$/,
      /\.llnwd\.net$/,
      /cdn\d*\./,
    ],
  },
  {
    category: "Tracking",
    patterns: [
      /mixpanel\.com/,
      /sentry\.io/,
      /segment\.io/,
      /amplitude\.com/,
      /fullstory\.com/,
      /heap\.io/,
      /hotjar\.com/,
      /datadoghq\.com/,
      /newrelic\.com/,
      /launchdarkly\.com/,
      /statsig\.com/,
      /bugsnag\.com/,
      /crashlytics\.com/,
      /firebase\.google\.com/,
      /analytics\.google\.com/,
      /telemetry\./,
      /\.analytics\./,
      /\.tracking\./,
    ],
  },
  {
    category: "Video",
    patterns: [
      /netflix\.com/,
      /nflxvideo\.net/,
      /\.hulu\.com$/,
      /prime-video/,
      /\.tiktok\.com$/,
      /\.tiktokcdn\.com$/,
      /nicovideo\.jp/,
      /abema\.tv/,
      /dtvce\.com/,
      /dmm\.com/,
      /paravi\.jp/,
    ],
  },
];

// ─── メイン分類関数 ───────────────────────────────────────────────────────────

export function getServiceCategory(domain: string | null | undefined): ServiceCategory {
  if (!domain) return "Unknown";
  const lower = domain.toLowerCase();
  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(lower)) return rule.category;
    }
  }
  return "Unknown";
}

// ─── 表示用定数 ───────────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  Apple:    "Apple",
  Google:   "Google",
  OpenAI:   "OpenAI",
  Twitch:   "Twitch",
  LINE:     "LINE",
  Brave:    "Brave",
  Supabase: "Supabase",
  CDN:      "CDN",
  Tracking: "トラッキング",
  Video:    "動画",
  Unknown:  "その他",
};

export const CATEGORY_COLOR: Record<ServiceCategory, string> = {
  Apple:    "bg-slate-500/20 text-slate-200 border-slate-500/40",
  Google:   "bg-blue-500/20 text-blue-200 border-blue-500/40",
  OpenAI:   "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  Twitch:   "bg-purple-500/20 text-purple-200 border-purple-500/40",
  LINE:     "bg-green-600/20 text-green-300 border-green-600/40",
  Brave:    "bg-orange-500/20 text-orange-200 border-orange-500/40",
  Supabase: "bg-teal-500/20 text-teal-200 border-teal-500/40",
  CDN:      "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
  Tracking: "bg-red-500/20 text-red-300 border-red-500/40",
  Video:    "bg-pink-500/20 text-pink-200 border-pink-500/40",
  Unknown:  "bg-slate-700/20 text-slate-400 border-slate-700/40",
};

// ─── 操作推定キーワード ───────────────────────────────────────────────────────

/** 認証系ドメインキーワード */
export const AUTH_KEYWORDS = [
  "auth", "oauth", "login", "token", "accounts", "signin",
  "sso", "identity", "session", "credential",
];

/** 動画系ドメインキーワード */
export const VIDEO_KEYWORDS = [
  "video", "stream", "vod", "hls", "dash", "media",
  "googlevideo", "ytimg", "nflxvideo", "video-weaver",
];

/** バックグラウンド同期系ドメインキーワード */
export const SYNC_KEYWORDS = [
  "bag", "gspe", "push", "notify", "sync", "courier",
  "ocsp", "time", "mesu", "xp.apple", "configuration",
  "captive", "gateway.icloud",
];
