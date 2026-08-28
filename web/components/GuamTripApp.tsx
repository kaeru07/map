"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  categoryMeta,
  checklist,
  distanceRings,
  eventRoutes,
  meals,
  schedule,
  Spot,
  spots,
} from "@/lib/guam-trip-data";

type Tab = "map" | "schedule" | "checklist" | "sources";
type GuamMapComponent = ComponentType<{
  selectedSpotId: number;
  activeRouteId: string | null;
  onSelectSpot: (id: number) => void;
}>;

function ConfidenceBadge({ spot }: { spot: Spot }) {
  const isConfirmed = spot.confidence === "confirmed";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isConfirmed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
      {isConfirmed ? "場所確認済み" : "要確認"}
    </span>
  );
}

function SpotPicker({
  selectedSpotId,
  onSelectSpot,
}: {
  selectedSpotId: number;
  onSelectSpot: (id: number) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
      <div className="mb-2 flex items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-bold">番号で移動</h2>
          <p className="text-[11px] text-zinc-500">押すと地図がその場所へ移動します</p>
        </div>
        <span className="text-[11px] font-semibold text-zinc-500">全{spots.length}件</span>
      </div>
      <div className="grid max-h-[210px] grid-cols-2 gap-1 overflow-auto pr-1 sm:grid-cols-3 lg:max-h-[240px]">
        {spots.map((spot) => (
          <button
            key={spot.id}
            onClick={() => onSelectSpot(spot.id)}
            className={`grid min-h-11 grid-cols-[30px_1fr] items-center gap-2 rounded-md border p-1.5 text-left text-xs ${
              selectedSpotId === spot.id
                ? "border-zinc-950 bg-zinc-100 shadow-inner"
                : "border-zinc-200 bg-white"
            }`}
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white"
              style={{ backgroundColor: categoryMeta[spot.category].color }}
            >
              {spot.label}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold leading-tight">{spot.shortName}</span>
              <span className="block truncate text-[10px] leading-tight text-zinc-500">
                {categoryMeta[spot.category].name} / {spot.recommended}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function GuamTripApp() {
  const [tab, setTab] = useState<Tab>("map");
  const [selectedSpotId, setSelectedSpotId] = useState(18);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(eventRoutes[0]?.id ?? null);
  const [MapComponent, setMapComponent] = useState<GuamMapComponent | null>(null);
  const activeRoute = useMemo(
    () => eventRoutes.find((route) => route.id === activeRouteId) ?? null,
    [activeRouteId]
  );
  const selectedSpot = useMemo(
    () => spots.find((spot) => spot.id === selectedSpotId) ?? spots[17],
    [selectedSpotId]
  );

  useEffect(() => {
    let active = true;
    import("@/components/GuamMap").then((mod) => {
      if (active) setMapComponent(() => mod.GuamMap);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Guam Trip Map</p>
            <h1 className="text-lg font-bold leading-tight">The Tsubaki Tower 起点マップ</h1>
          </div>
          <a
            href="https://www.openstreetmap.org/?mlat=13.5214913&mlon=144.8059738#map=16/13.5214913/144.8059738"
            className="rounded-md bg-zinc-950 px-3 py-2 text-xs font-semibold text-white"
          >
            元地図
          </a>
        </div>
        <nav className="mx-auto grid max-w-6xl grid-cols-4 gap-1 px-3 pb-2 text-xs font-semibold">
          {[
            ["map", "地図"],
            ["schedule", "予定"],
            ["checklist", "準備"],
            ["sources", "場所"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`h-9 rounded-md border ${tab === key ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "map" && (
        <main className="mx-auto grid max-w-6xl gap-2 p-2 sm:p-3 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-2">
            <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="grid gap-3">
                <div>
                  <h2 className="text-sm font-bold">イベント経路</h2>
                  <p className="text-xs text-zinc-600">
                    {activeRoute?.description ?? "日程別の経路を選ぶと地図に線と順番が表示されます"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    経路線は主要道路に沿う目安です。実際の所要時間と通行可否は現地の地図アプリで確認してください。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {eventRoutes.map((route) => {
                    const isActive = activeRouteId === route.id;
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => setActiveRouteId((current) => current === route.id ? null : route.id)}
                        className={`min-h-11 rounded-md border px-2 py-2 text-left text-[11px] font-semibold leading-tight ${
                          isActive
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : "border-zinc-200 bg-white text-zinc-700"
                        }`}
                      >
                        <span className="mb-1 block h-1.5 w-8 rounded-full" style={{ backgroundColor: route.color }} />
                        {isActive ? `${route.label} 表示中` : route.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="h-[52dvh] min-h-[360px] lg:h-[calc(100dvh-350px)] lg:min-h-[460px]">
                {MapComponent ? (
                  <MapComponent
                    selectedSpotId={selectedSpotId}
                    activeRouteId={activeRouteId}
                    onSelectSpot={setSelectedSpotId}
                  />
                ) : (
                  <div className="grid h-full min-h-[52vh] place-items-center text-sm text-zinc-500">地図を読み込み中</div>
                )}
              </div>
            </section>

            <SpotPicker selectedSpotId={selectedSpotId} onSelectSpot={setSelectedSpotId} />
          </div>

          <aside className="grid content-start gap-2">
            <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">{categoryMeta[selectedSpot.category].name}</p>
                  <h2 className="text-base font-bold">{selectedSpot.label} {selectedSpot.name}</h2>
                </div>
                <ConfidenceBadge spot={selectedSpot} />
              </div>
              <p className="text-sm text-zinc-700">{selectedSpot.notes}</p>
              <div className="mt-3 rounded-md bg-zinc-100 p-3 text-sm">
                <p className="font-bold">推奨: {selectedSpot.recommended}</p>
                <div className="mt-2 grid gap-1">
                  {Object.entries(selectedSpot.transportNotes).map(([mode, note]) => (
                    <p key={mode}><span className="font-semibold">{mode}:</span> {note}</p>
                  ))}
                </div>
              </div>
              <a className="mt-3 block text-sm font-semibold text-blue-700" href={selectedSpot.sourceUrl}>
                確認ページを見る
              </a>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm">
              <h2 className="font-bold">距離リング / mobi</h2>
              <div className="mt-2 grid gap-2">
                {distanceRings.map((ring) => (
                  <div key={ring.label} className="flex gap-2">
                    <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: ring.color }} />
                    <p><span className="font-semibold">{ring.label}</span><br />{ring.description}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                mobi利用可能エリアは推定表示です。実際の利用可否は現地アプリで確認。
              </p>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm">
              <h2 className="font-bold">食事候補</h2>
              <div className="mt-2 grid gap-3">
                {meals.map((meal) => (
                  <div key={meal.title}>
                    <p className="font-semibold">{meal.title}</p>
                    <p>{meal.candidates.join(" / ")}</p>
                    <p className="text-xs text-zinc-600">{meal.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>
      )}

      {tab === "schedule" && (
        <main className="mx-auto grid max-w-3xl gap-3 p-3">
          {schedule.map((day) => (
            <section key={day.date} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">{day.date}</h2>
              <div className="mt-3 grid gap-2 text-sm">
                {day.items.map((item) => (
                  <div key={item} className="rounded-md bg-zinc-100 px-3 py-2">{item}</div>
                ))}
              </div>
              {day.candidates && (
                <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
                  <p className="font-bold">夜ご飯候補</p>
                  <p>{day.candidates.join(" / ")}</p>
                </div>
              )}
            </section>
          ))}
        </main>
      )}

      {tab === "checklist" && (
        <main className="mx-auto grid max-w-3xl gap-3 p-3">
          {checklist.map((item) => (
            <a key={item.url} href={item.url} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-base font-bold">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-700">{item.description}</p>
              <p className="mt-2 break-all text-xs font-semibold text-blue-700">{item.url}</p>
            </a>
          ))}
        </main>
      )}

      {tab === "sources" && (
        <main className="mx-auto grid max-w-5xl gap-3 p-3">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">場所の確認メモ</h2>
            <p className="mt-1 text-sm text-zinc-600">場所を確定できないものは「要確認」として表示しています。</p>
            <div className="mt-3 grid gap-2">
              {spots.map((spot) => (
                <div key={spot.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{spot.label} {spot.name}</p>
                    <ConfidenceBadge spot={spot} />
                  </div>
                  <p className="mt-1 font-mono text-xs">{spot.lat.toFixed(7)}, {spot.lng.toFixed(7)}</p>
                  <p className="mt-1 text-xs text-zinc-600">確認方法: {spot.source}</p>
                  <a className="mt-1 block text-xs font-semibold text-blue-700" href={spot.sourceUrl}>
                    確認ページを開く
                  </a>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
