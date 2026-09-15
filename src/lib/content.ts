import { getCollection, getEntry, type CollectionEntry } from 'astro:content'
import type { ImageMetadata } from 'astro'

export type Pizzeria = {
  _id: string
  name: string
  slug: string
  location: { city: string; country: string; raw?: string }
  geopoint?: { lat: number; lng: number }
  favourite?: boolean
}

export type PizzaEntry = {
  _id: string
  pizzaName: string
  pizzeria: Pizzeria
  dateEaten: string
  rating: number
  price?: { amount?: number; currency?: string; raw?: string }
  notes?: string
  photo?: ImageMetadata
  slug: string
}

function toPizzeria({ id, data }: CollectionEntry<'pizzerias'>): Pizzeria {
  return { _id: id, slug: id, ...data }
}

async function toPizza({ id, data }: CollectionEntry<'pizzas'>): Promise<PizzaEntry> {
  const pizzeria = await getEntry(data.pizzeria)
  if (!pizzeria) {
    throw new Error(`Pizza "${id}" references unknown pizzeria "${data.pizzeria.id}"`)
  }
  return { _id: id, slug: id, ...data, pizzeria: toPizzeria(pizzeria) }
}

export async function getAllPizzas(): Promise<PizzaEntry[]> {
  const pizzas = await Promise.all((await getCollection('pizzas')).map(toPizza))
  return pizzas.sort((a, b) => b.dateEaten.localeCompare(a.dateEaten))
}

export async function getAllPizzaSlugs(): Promise<string[]> {
  return (await getCollection('pizzas')).map((p) => p.id)
}

export async function getPizzaBySlug(slug: string): Promise<PizzaEntry | null> {
  const pizza = await getEntry('pizzas', slug)
  return pizza ? toPizza(pizza) : null
}

export async function getAllPizzerias(): Promise<(Pizzeria & { visits: number })[]> {
  const pizzas = await getCollection('pizzas')
  return (await getCollection('pizzerias'))
    .map((p) => ({
      ...toPizzeria(p),
      visits: pizzas.filter((pizza) => pizza.data.pizzeria.id === p.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getAllPizzeriaSlugs(): Promise<string[]> {
  return (await getCollection('pizzerias')).map((p) => p.id)
}

export async function getPizzeriaBySlug(slug: string): Promise<Pizzeria | null> {
  const pizzeria = await getEntry('pizzerias', slug)
  return pizzeria ? toPizzeria(pizzeria) : null
}

export async function getPizzasByPizzeria(pizzeriaId: string): Promise<PizzaEntry[]> {
  return (await getAllPizzas()).filter((p) => p.pizzeria._id === pizzeriaId)
}

export function formatPrice(price: PizzaEntry['price']): string | null {
  if (!price) return null
  if (price.amount != null && price.currency) {
    const symbols: Record<string, string> = {
      GBP: '£',
      EUR: '€',
      USD: '$',
      JPY: '¥',
    }
    const symbol = symbols[price.currency] ?? `${price.currency} `
    return `${symbol}${price.amount}`
  }
  return price.raw ?? null
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
