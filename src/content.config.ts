import { defineCollection, reference } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const pizzerias = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/pizzerias' }),
  schema: z.object({
    name: z.string(),
    location: z.object({
      city: z.string(),
      country: z.string(),
      raw: z.string().optional(),
    }),
    geopoint: z.object({ lat: z.number(), lng: z.number() }).optional(),
    favourite: z.boolean().optional(),
  }),
})

const pizzas = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/pizzas' }),
  schema: ({ image }) =>
    z.object({
      pizzaName: z.string(),
      pizzeria: reference('pizzerias'),
      dateEaten: z.iso.date(),
      rating: z.number().int().min(0).max(5),
      price: z
        .object({
          amount: z.number().optional(),
          currency: z.string().optional(),
          raw: z.string().optional(),
        })
        .optional(),
      notes: z.string().optional(),
      photo: image().optional(),
    }),
})

export const collections = { pizzerias, pizzas }
