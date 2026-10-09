import type { PizzaEntry, Pizzeria } from './content'

export type RankedStat = {
  name: string
  href?: string
  detail: string
  count: number
  rating: number
}
export type YearStat = { year: number; count: number; avgRating: number }

// How many "phantom visits" of the overall average get mixed into each
// group's own average before ranking (see rankByWeightedAverage). Higher =
// more visits needed before a group's own rating can pull away from the pack.
const OVERALL_WEIGHT = 3

type Group = {
  name: string
  pizzerias: Map<string, Pizzeria>
  total: number
  count: number
}

function groupPizzas(
  pizzas: PizzaEntry[],
  keyOf: (pizza: PizzaEntry) => { key: string; name: string }
): Group[] {
  const groups = new Map<string, Group>()
  for (const pizza of pizzas) {
    const { key, name } = keyOf(pizza)
    const group = groups.get(key) ?? {
      name,
      pizzerias: new Map(),
      total: 0,
      count: 0,
    }
    group.pizzerias.set(pizza.pizzeria._id, pizza.pizzeria)
    group.total += pizza.rating
    group.count += 1
    groups.set(key, group)
  }
  return [...groups.values()]
}

// Ranks by a Bayesian average, not the raw average: a single 5-star visit is
// blended with the overall average (weighted as if it were OVERALL_WEIGHT
// more visits at the overall average) before ranking, so it can't outrank a
// place proven great over many visits. Callers still show each group's real,
// unblended average.
function rankByWeightedAverage(
  pizzas: PizzaEntry[],
  groups: Group[],
  limit: number
): Group[] {
  if (pizzas.length === 0) return []
  const overallAvg =
    pizzas.reduce((sum, p) => sum + p.rating, 0) / pizzas.length
  const weighted = (g: Group) =>
    (g.total + OVERALL_WEIGHT * overallAvg) / (g.count + OVERALL_WEIGHT)
  return [...groups]
    .sort((a, b) => weighted(b) - weighted(a) || b.count - a.count)
    .slice(0, limit)
}

// "Camberwell, London" and "London" are both London.
export function cityOf(pizzeria: Pizzeria): string {
  return pizzeria.location.city.split(',').at(-1)!.trim()
}

// Branches of the same chain rank as one entry; a chain with a single
// visited branch reads and links like any other pizzeria.
export function topPizzerias(pizzas: PizzaEntry[], limit = 8): RankedStat[] {
  const groups = groupPizzas(pizzas, ({ pizzeria }) => ({
    key: pizzeria.chain ?? pizzeria._id,
    name: pizzeria.chain ?? pizzeria.name,
  }))
  return rankByWeightedAverage(pizzas, groups, limit).map((g) => {
    const branches = [...g.pizzerias.values()]
    const cities = [...new Set(branches.map(cityOf))].join(', ')
    const stat = { count: g.count, rating: g.total / g.count }
    return branches.length === 1
      ? {
          ...stat,
          name: branches[0].name,
          href: `/pizzeria/${branches[0].slug}/`,
          detail: cities,
        }
      : {
          ...stat,
          name: g.name,
          detail: `${branches.length} branches in ${cities}`,
        }
  })
}

// Towns passed through for a single pizza would otherwise crowd the list.
const MIN_PIZZAS_PER_CITY = 2

export function topCities(pizzas: PizzaEntry[], limit = 8): RankedStat[] {
  const groups = groupPizzas(pizzas, ({ pizzeria }) => ({
    key: `${cityOf(pizzeria)}|${pizzeria.location.country}`,
    name: cityOf(pizzeria),
  })).filter((g) => g.count >= MIN_PIZZAS_PER_CITY)
  return rankByWeightedAverage(pizzas, groups, limit).map((g) => {
    const places = g.pizzerias.size
    const [first] = g.pizzerias.values()
    return {
      name: g.name,
      detail: `${first.location.country}, ${places} pizzeria${places === 1 ? '' : 's'}`,
      count: g.count,
      rating: g.total / g.count,
    }
  })
}

// Surfaces pizzerias explicitly flagged `favourite` in their content entry,
// independent of topPizzerias' ranking — a hand-picked call-out rather than
// something derived from visit count or rating.
export function personalFavourites(pizzas: PizzaEntry[]): RankedStat[] {
  return groupPizzas(
    pizzas.filter((p) => p.pizzeria.favourite),
    ({ pizzeria }) => ({ key: pizzeria._id, name: pizzeria.name })
  )
    .map((g) => {
      const [pizzeria] = g.pizzerias.values()
      return {
        name: g.name,
        href: `/pizzeria/${pizzeria.slug}/`,
        detail: cityOf(pizzeria),
        count: g.count,
        rating: g.total / g.count,
      }
    })
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
