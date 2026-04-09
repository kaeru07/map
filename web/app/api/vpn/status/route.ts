import { execFile } from "child_process";
import { promisify } from "util";
import { VpnClient, VPN_CLIENT_NAMES } from "@/lib/types";

const execFileAsync = promisify(execFile);

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function fmtHandshake(unixTs: number): string {
  if (unixTs === 0) return "なし";
  const secs = Math.floor(Date.now() / 1000) - unixTs;
  if (secs < 0) return "なし";
  if (secs < 60) return `${secs} 秒前`;
  if (secs < 3600) return `${Math.floor(secs / 60)} 分前`;
  return `${Math.floor(secs / 3600)} 時間前`;
}

export async function GET() {
  try {
    const { stdout } = await execFileAsync("wg", ["show", "all", "dump"], {
      timeout: 5000,
    });

    const clients: VpnClient[] = [];

    for (const line of stdout.trim().split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      // interface lines: 5 fields, peer lines: 9 fields
      if (parts.length !== 9) continue;

      const [iface, , , endpoint, allowedIps, handshakeRaw, rxRaw, txRaw] = parts;

      if (!allowedIps || !allowedIps.includes("/")) continue;

      const ip = allowedIps.split(",")[0].trim().split("/")[0];
      const ts = parseInt(handshakeRaw, 10);
      const rx = parseInt(rxRaw, 10);
      const tx = parseInt(txRaw, 10);

      clients.push({
        interface: iface,
        ip,
        name: VPN_CLIENT_NAMES[ip] ?? ip,
        endpoint: endpoint === "(none)" ? null : endpoint,
        handshake: fmtHandshake(ts),
        handshakeTs: ts,
        rx: fmtBytes(isNaN(rx) ? 0 : rx),
        tx: fmtBytes(isNaN(tx) ? 0 : tx),
        connected: ts > 0 && Date.now() / 1000 - ts < 180,
      });
    }

    return Response.json({ clients });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ clients: [], error: msg }, { status: 500 });
  }
}
