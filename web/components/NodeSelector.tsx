"use client";

import {
  VirtualNode,
  VIRTUAL_NODES,
  ROLE_ICON,
  ROLE_BADGE,
  ROLE_COLOR,
  ROLE_LABEL_JA,
} from "@/lib/nodes";

interface Props {
  label: string;
  value: VirtualNode;
  onChange?: (node: VirtualNode) => void;
  /** このIDのノードを選択肢から除外する（攻撃元と攻撃対象が同じにならないよう） */
  excludeId?: string;
  /** true のとき読み取り専用表示（攻撃元など固定ノード用） */
  readonly?: boolean;
}

export function NodeSelector({
  label,
  value,
  onChange,
  excludeId,
  readonly = false,
}: Props) {
  const options = VIRTUAL_NODES.filter((n) => n.id !== excludeId);

  return (
    <div className="flex flex-col gap-1.5">
      {/* ラベル */}
      <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider font-medium">
        {label}
      </span>

      {readonly ? (
        /* ── 読み取り専用表示（攻撃元） ─────────────────────────────────────── */
        <div className="flex items-center gap-2.5 rounded border border-slate-700 bg-slate-800/50 px-3 py-2.5 cursor-not-allowed">
          <span className={`text-base ${ROLE_COLOR[value.role]}`}>
            {ROLE_ICON[value.role]}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-200">{value.name}</span>
            <span className="ml-2 font-mono text-xs text-slate-500">{value.ip}</span>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[value.role]}`}
          >
            {ROLE_LABEL_JA[value.role]}
          </span>
        </div>
      ) : (
        /* ── ドロップダウン選択（攻撃対象） ─────────────────────────────────── */
        <div className="relative">
          <select
            value={value.id}
            onChange={(e) => {
              const node = options.find((n) => n.id === e.target.value);
              if (node && onChange) onChange(node);
            }}
            className="w-full appearance-none rounded border border-slate-600 bg-slate-900 pl-3 pr-8 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors hover:border-slate-500"
          >
            {options.map((n) => (
              <option key={n.id} value={n.id}>
                {ROLE_ICON[n.role]} {n.name} ({n.ip})
              </option>
            ))}
          </select>
          {/* カスタム矢印 */}
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] select-none">
            ▼
          </span>
        </div>
      )}

      {/* 選択中ノードのロールバッジ + IP — 読み取り専用でないときのみ */}
      {!readonly && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[value.role]}`}
          >
            {ROLE_ICON[value.role]} {ROLE_LABEL_JA[value.role]}
          </span>
          <span className="font-mono text-xs text-slate-500">{value.ip}</span>
          {value.description && (
            <span className="text-[10px] text-slate-600 truncate hidden sm:block">
              — {value.description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
