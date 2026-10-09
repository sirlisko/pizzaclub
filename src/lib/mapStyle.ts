import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

// Matches the site's tokens in Layout.astro: land is the page ground, so the
// map reads as part of the page rather than a pasted-in street map.
const LAND = '#b3301f'
const WATER = '#8c2414'
const BUILDING = '#bc3826'
const INK = '#fffdf9'
const ink = (alpha: number) => `rgb(255 253 249 / ${alpha})`

// Labels whose dot icons we drop but whose text we keep.
const PLACE_LABEL = /^label_/

function restyle(layer: LayerSpecification): LayerSpecification | null {
  const { id } = layer
  const paint: Record<string, unknown> = { ...(layer as any).paint }
  const layout: Record<string, unknown> = { ...(layer as any).layout }

  switch (layer.type) {
    case 'background':
      return { ...layer, paint: { 'background-color': LAND } }
    case 'fill':
      if (id === 'water') return { ...layer, paint: { 'fill-color': WATER } }
      if (id === 'building')
        return { ...layer, paint: { 'fill-color': BUILDING } }
      return null
    case 'line':
      if (id.startsWith('waterway'))
        return { ...layer, paint: { ...paint, 'line-color': WATER } }
      if (id.startsWith('boundary'))
        return { ...layer, paint: { ...paint, 'line-color': ink(0.4) } }
      if (/casing|hatching|aeroway|park_outline/.test(id)) return null
      return {
        ...layer,
        paint: { ...paint, 'line-color': ink(0.12), 'line-opacity': 1 },
      }
    case 'symbol': {
      const isPlace = PLACE_LABEL.test(id)
      const isWater = id.startsWith('water')
      if (!isPlace && !isWater) return null
      delete layout['icon-image']
      return {
        ...layer,
        layout,
        paint: {
          'text-color': isWater ? ink(0.55) : INK,
          'text-halo-color': isWater ? WATER : LAND,
          'text-halo-width': 1.2,
        },
      } as LayerSpecification
    }
    default:
      // Raster relief, 3D buildings and anything else off-palette.
      return null
  }
}

export function pizzaClubStyle(
  _previous: StyleSpecification | undefined,
  next: StyleSpecification
): StyleSpecification {
  return {
    ...next,
    layers: next.layers
      .map(restyle)
      .filter((layer): layer is LayerSpecification => layer !== null),
  }
}
