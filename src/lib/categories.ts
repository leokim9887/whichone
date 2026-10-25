import { CATEGORIES, type Category } from "@/lib/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  daily: "일상",
  love: "연애",
  money: "돈·경제",
  work: "직장·커리어",
  food: "음식",
  values: "가치관",
};

export const CATEGORY_FILTERS = ["all", ...CATEGORIES] as const;

export type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

export function isCategory(value: string): value is Category {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABEL, value);
}

export function isCategoryFilter(value: string): value is CategoryFilter {
  return value === "all" || isCategory(value);
}

export function categoryLabel(category: Category): string {
  return CATEGORY_LABEL[category];
}
