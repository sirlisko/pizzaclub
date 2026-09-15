/**
 * Turns a reviewer export (photo-import/review → "Export choices") into content files:
 * src/content/pizzas/<slug>.json, a WebP photo next to it, and any new
 * src/content/pizzerias/<slug>.json.
 *
 * Usage: pnpm import:photos ~/Downloads/pizza-review.json [--dry-run]
 *
 * Reads the local, gitignored photo-import/ workspace (originals, Photos metadata,
 * data/imported-ids.json, optional data/guesses.json). Visits already in imported-ids.json
 * or whose entry file exists are skipped, so it's safe to re-run.
 */
import sharp from 'sharp'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ReviewVisit = {
  id: string
  date: string
  lat: number | null
  lng: number | null
  osm: Record<string, { lat: number; lng: number }>
  pizzeria: string
  photo: string
  pizzaName: string
  rating: string
  notes: string
  rotation: number
}

type Pizzeria = {
  name: string
  location: { city: string; country: string; raw?: string }
  geopoint?: { lat: number; lng: number }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspace = path.join(repoRoot, 'photo-import')
const pizzasDir = path.join(repoRoot, 'src/content/pizzas')
const pizzeriasDir = path.join(repoRoot, 'src/content/pizzerias')

// Chains whose branches the reviewer can't tell apart: (name, lat rounded to 4dp) → branch.
const BRANCH: Record<string, string> = {
  "Rudy's Pizza Napoletana|51.5132": "Rudy's Pizza Napoletana - Soho",
  "Rudy's Pizza Napoletana|51.5242": "Rudy's Pizza Napoletana - Shoreditch",
  "Rudy's Pizza Napoletana|51.5195": "Rudy's Pizza Napoletana - Fitzrovia",
  "Rudy's Pizza Napoletana|51.5205": "Rudy's Pizza Napoletana - Spitalfields",
  'Franco Manca|51.4582': 'Franco Manca - Northcote Road',
  'Franco Manca|51.5063': 'Franco Manca - Borough Market',
}

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf-8'))
const writeJson = (file: string, data: unknown) =>
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/'/g, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const [reviewPath, ...flags] = process.argv.slice(2)
if (!reviewPath) throw new Error('Usage: pnpm import:photos path/to/pizza-review.json [--dry-run]')
const dryRun = flags.includes('--dry-run')

const importedPath = path.join(workspace, 'data/imported-ids.json')
const imported: string[] = readJson(importedPath)
const files: Record<string, string> = readJson(path.join(workspace, 'data/photo-files.json'))
const guessesPath = path.join(workspace, 'data/guesses.json')
const guesses: Record<string, string> = existsSync(guessesPath) ? readJson(guessesPath) : {}
const places: Record<string, any> = {}
for (const f of ['album.json', 'label.json']) {
  for (const p of readJson(path.join(workspace, 'data', f))) places[p.uuid] = p.place ?? {}
}

const pizzerias = new Map<string, Pizzeria>()
for (const f of readdirSync(pizzeriasDir)) {
  pizzerias.set(path.basename(f, '.json'), readJson(path.join(pizzeriasDir, f)))
}
const slugByName = new Map([...pizzerias].map(([slug, p]) => [p.name, slug]))

const visits: ReviewVisit[] = readJson(path.resolve(reviewPath)).filter(
  (v: ReviewVisit) => v.pizzeria && v.rating !== '' && !imported.includes(v.id)
)

const newPizzerias = new Map<string, Pizzeria>()
const entries: { slug: string; visit: ReviewVisit; pizzeriaSlug: string; pizzaName: string; guessed: boolean }[] = []

for (const visit of visits) {
  const geo = visit.osm[visit.pizzeria] ?? (visit.lat != null ? { lat: visit.lat, lng: visit.lng! } : undefined)
  const name = (geo && BRANCH[`${visit.pizzeria}|${geo.lat.toFixed(4)}`]) || visit.pizzeria
  let pizzeriaSlug = slugByName.get(name) ?? kebab(name)
  if (!pizzerias.has(pizzeriaSlug) && !newPizzerias.has(pizzeriaSlug)) {
    const place = places[visit.id] ?? {}
    const cc = place.address?.iso_country_code ?? ''
    newPizzerias.set(pizzeriaSlug, {
      name,
      location: { city: place.address?.city ?? '', country: cc === 'GB' ? 'UK' : cc, raw: place.address_str ?? '' },
      ...(geo && { geopoint: geo }),
    })
  }

  let slug = `${pizzeriaSlug}-${visit.date}`
  for (let n = 2; entries.some((e) => e.slug === slug); n++) slug = `${pizzeriaSlug}-${visit.date}-${n}`
  if (existsSync(path.join(pizzasDir, `${slug}.json`))) continue

  const guessed = !visit.pizzaName
  entries.push({ slug, visit, pizzeriaSlug, pizzaName: visit.pizzaName || guesses[visit.id] || 'Bufala', guessed })
}

for (const [slug, p] of newPizzerias) {
  const missing = !p.location.city || !p.location.country ? '  ⚠ missing city/country' : ''
  console.log(`NEW PIZZERIA ${slug}: ${p.name} — ${p.location.city}, ${p.location.country}${p.geopoint ? '' : '  ⚠ no map location'}${missing}`)
}
for (const e of entries) {
  console.log(`${e.visit.date}  ${pizzerias.get(e.pizzeriaSlug)?.name ?? newPizzerias.get(e.pizzeriaSlug)!.name}  |  ${e.pizzaName}${e.guessed ? ' (guessed)' : ''}  |  ${e.visit.rating}/5`)
}
console.log(`${newPizzerias.size} new pizzerias, ${entries.length} entries${dryRun ? ' (dry run, nothing written)' : ''}`)
if (dryRun) process.exit(0)

for (const [slug, p] of newPizzerias) writeJson(path.join(pizzeriasDir, `${slug}.json`), p)

for (const { slug, visit, pizzeriaSlug, pizzaName } of entries) {
  const source = files[visit.photo]
  if (!source) throw new Error(`No exported original for photo ${visit.photo} (visit ${visit.date})`)
  // The reviewer shows photos EXIF-corrected, so its rotation applies on top of autoOrient.
  // sharp drops all metadata (including GPS) on output.
  await sharp(source)
    .autoOrient()
    .rotate(visit.rotation)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(path.join(pizzasDir, 'photos', `${slug}.webp`))
  writeJson(path.join(pizzasDir, `${slug}.json`), {
    pizzaName,
    pizzeria: pizzeriaSlug,
    dateEaten: visit.date,
    rating: Number(visit.rating),
    ...(visit.notes && { notes: visit.notes }),
    photo: `./photos/${slug}.webp`,
  })
  imported.push(visit.id)
}

writeJson(importedPath, imported)
console.log('Written. Rebuild the reviewer: python3 -I photo-import/tools/build_review.py photo-import')
