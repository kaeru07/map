#!/usr/bin/env bash
# =============================================================================
# import.sh — パース済み JSON を SQLite にインポートするスクリプト
#
# 使い方:
#   ./scripts/import.sh <parsed.json>       # 解析済み JSON から直接インポート
#   ./scripts/import.sh <raw_tshark.json>   # tshark 生出力 → parse → インポート
#
# 環境変数:
#   DATABASE_URL  — SQLite DB ファイルパス (例: file:./prisma/dev.db)
#   WEB_DIR       — web/ ディレクトリパス (デフォルト: ./web)
# =============================================================================

set -euo pipefail

INPUT="${1:-}"
WEB_DIR="${WEB_DIR:-$(dirname "$0")/../web}"
SCRIPT_DIR="$(dirname "$0")"

if [[ -z "$INPUT" ]]; then
  echo "使い方: $0 <json_file>"
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "[error] ファイルが見つかりません: $INPUT"
  exit 1
fi

# tshark 生出力か parse 済みかを判定 (先頭に _source キーがあれば生)
IS_RAW=$(python3 -c "
import json, sys
with open('$INPUT') as f:
  data = json.load(f)
if isinstance(data, list) and data and '_source' in data[0]:
  print('1')
else:
  print('0')
" 2>/dev/null || echo "0")

PARSED_JSON="$INPUT"

if [[ "$IS_RAW" == "1" ]]; then
  echo "[import] tshark 生出力を検出 → parse.py で変換中..."
  PARSED_JSON="${INPUT%.json}_parsed.json"
  python3 "$SCRIPT_DIR/parse.py" "$INPUT" "$PARSED_JSON"
fi

echo "[import] SQLite にインポート中: $PARSED_JSON"

# Node.js で Prisma 経由でインポート
cd "$WEB_DIR"
npx tsx - <<'TSEOF' -- "$PARSED_JSON"
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./app/generated/prisma/client";
import { readFileSync } from "fs";
import path from "path";

const inputFile = process.argv[process.argv.length - 1];
const dbEnv = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const dbUrl = dbEnv.startsWith("file:./")
  ? `file:${path.resolve(process.cwd(), dbEnv.replace("file:./", ""))}`
  : dbEnv;

const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const records = JSON.parse(readFileSync(inputFile, "utf-8"));

let inserted = 0;
let skipped = 0;

for (const rec of records) {
  try {
    await prisma.packet.create({
      data: {
        timestamp: new Date(rec.timestamp),
        srcIp: rec.srcIp,
        dstIp: rec.dstIp,
        srcPort: rec.srcPort ?? null,
        dstPort: rec.dstPort ?? null,
        protocol: rec.protocol,
        bytes: rec.bytes ?? null,
        direction: rec.direction ?? null,
        hostName: rec.hostName ?? null,
        tlsSni: rec.tlsSni ?? null,
        dnsQuery: rec.dnsQuery ?? null,
        rawJson: rec.rawJson ?? null,
      },
    });
    inserted++;
  } catch (e) {
    skipped++;
  }
}

await prisma.$disconnect();
console.log(`[import] 完了: ${inserted} 件追加, ${skipped} 件スキップ`);
TSEOF
