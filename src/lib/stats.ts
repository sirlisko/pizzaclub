import type { PizzaEntry } from './content'

export type PizzeriaStat = {
  pizzeria: string
  slug: string
  count: number
  rating: number
}
export type YearStat = { year: number; count: number; avgRating: number }

// How many "phantom visits" of the overall average get mixed into each
// pizzeria's own average before ranking (see topPizzerias). Higher = more
// visits needed before a pizzeria's own rating can pull away from the pack.
const OVERALL_WEIGHT = 3

function groupByPizzeria(pizzas: PizzaEntry[]) {
  const byPizzeria = new Map<
    string,
    {
      pizzeria: string
      slug: string
      favourite: boolean
      total: number
      count: number
    }
  >()
  for (const pizza of pizzas) {
    const entry = byPizzeria.get(pizza.pizzeria._id) ?? {
      pizzeria: pizza.pizzeria.name,
      slug: pizza.pizzeria.slug,
      favourite: Boolean(pizza.pizzeria.favourite),
      total: 0,
      count: 0,
    }
    entry.total += pizza.rating
    entry.count += 1
    byPizzeria.set(pizza.pizzeria._id, entry)
  }
  return byPizzeria
}

// Ranks by a Bayesian average, not the raw per-pizzeria average: a single
// 5-star visit is blended with the overall average (weighted as if it were
// OVERALL_WEIGHT more visits at the overall average) before ranking, so it
// can't outrank a place proven great over many visits. The displayed
// `rating` is still each pizzeria's real, unblended average.
export function topPizzerias(pizzas: PizzaEntry[], limit = 8): PizzeriaStat[] {
  if (pizzas.length === 0) return []
  const overallAvg =
    pizzas.reduce((sum, p) => sum + p.rating, 0) / pizzas.length

  return [...groupByPizzeria(pizzas).values()]
    .map(({ pizzeria, slug, total, count }) => {
      const rating = total / count
      const weighted =
        (count * rating + OVERALL_WEIGHT * overallAvg) /
        (count + OVERALL_WEIGHT)
      return { pizzeria, slug, count, rating, weighted }
    })
    .sort((a, b) => b.weighted - a.weighted || b.count - a.count)
    .slice(0, limit)
    .map(({ pizzeria, slug, count, rating }) => ({
      pizzeria,
      slug,
      count,
      rating,
    }))
}

// Surfaces pizzerias explicitly flagged `favourite` in Sanity, independent
// of topPizzerias' ranking — a hand-picked call-out rather than something
// derived from visit count or rating.
export function personalFavourites(pizzas: PizzaEntry[]): PizzeriaStat[] {
  return [...groupByPizzeria(pizzas).values()]
    .filter((p) => p.favourite)
    .map(({ pizzeria, slug, total, count }) => ({
      pizzeria,
      slug,
      count,
      rating: total / count,
    }))
    .sort((a, b) => b.rating - a.rating || a.count - b.count)
}

export function countriesVisited(pizzas: PizzaEntry[]): string[] {
  return [...new Set(pizzas.map((p) => p.pizzeria.location.country))].sort()
}

export function pizzasPerYear(pizzas: PizzaEntry[]): YearStat[] {
  const byYear = new Map<number, { total: number; count: number }>()
  for (const pizza of pizzas) {
    const year = new Date(pizza.dateEaten).getUTCFullYear()
    const entry = byYear.get(year) ?? { total: 0, count: 0 }
    entry.total += pizza.rating
    entry.count += 1
    byYear.set(year, entry)
  }
  return [...byYear.entries()]
    .map(([year, { total, count }]) => ({
      year,
      count,
      avgRating: total / count,
    }))
    .sort((a, b) => a.year - b.year)
}
