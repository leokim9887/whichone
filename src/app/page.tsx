import { Suspense } from "react";

import { HomeView } from "@/components/home-view";
import { HomeSkeleton } from "@/components/skeletons";
import { isCategoryFilter } from "@/lib/categories";
import { loadHome } from "@/lib/data";
import { LIMITS } from "@/lib/limits";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCategory = firstParam(params.category);
  const category = isCategoryFilter(rawCategory) ? rawCategory : "all";
  const query = firstParam(params.q).trim().slice(0, LIMITS.search);
  const data = await loadHome();
  return <HomeView data={data} category={category} query={query} />;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
