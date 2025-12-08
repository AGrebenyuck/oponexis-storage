// lib/telegram/services/collage.js

import sharp from 'sharp'

/* ====================== ЦИФРЫ БЕЗ <text> ====================== */
/* Семисегментные цифры из прямоугольников — не зависят от шрифта */

const DIGIT_SEGMENTS = {
	0: ['A', 'B', 'C', 'D', 'E', 'F'],
	1: ['B', 'C'],
	2: ['A', 'B', 'G', 'E', 'D'],
	3: ['A', 'B', 'G', 'C', 'D'],
	4: ['F', 'G', 'B', 'C'],
	5: ['A', 'F', 'G', 'C', 'D'],
	6: ['A', 'F', 'G', 'C', 'D', 'E'],
	7: ['A', 'B', 'C'],
	8: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
	9: ['A', 'B', 'C', 'D', 'F', 'G'],
}

// Координаты сегментов одной цифры в локальной системе 0..20
const SEGMENT_RECTS = {
	// Горизонтальные
	A: { x: 2, y: 0, width: 10, height: 3 },
	D: { x: 2, y: 17, width: 10, height: 3 },
	G: { x: 2, y: 8, width: 10, height: 3 },
	// Вертикальные
	F: { x: 1, y: 2, width: 3, height: 8 },
	E: { x: 1, y: 9, width: 3, height: 8 },
	B: { x: 11, y: 2, width: 3, height: 8 },
	C: { x: 11, y: 9, width: 3, height: 8 },
}

/**
 * Генерирует набор <rect> для одной цифры
 */
function renderDigitRects(digit) {
	const segments = DIGIT_SEGMENTS[digit] || []
	return segments
		.map(key => {
			const seg = SEGMENT_RECTS[key]
			if (!seg) return ''
			return `<rect x="${seg.x}" y="${seg.y}" width="${seg.width}" height="${seg.height}" rx="1" ry="1" />`
		})
		.join('\n')
}

/**
 * Генерирует SVG-бейдж с кружком и цифрами внутри (Buffer для sharp.composite)
 * @param {number} globalIndex
 */
function makeBadgeSvg(globalIndex) {
	const digits = String(globalIndex).split('') // "12" -> ["1","2"]

	// параметры цифр
	const digitWidth = 16 // ширина ячейки под одну цифру
	const digitSpacing = 2
	const totalWidth =
		digits.length * digitWidth + (digits.length - 1) * digitSpacing

	// центр круга — 45,45
	const centerX = 45
	const centerY = 45

	const startX = centerX - totalWidth / 2
	const baseY = centerY - 10 // немного выше центра

	const digitsGroups = digits
		.map((digit, index) => {
			const offsetX = startX + index * (digitWidth + digitSpacing)
			return `
        <g transform="translate(${offsetX}, ${baseY})" fill="#ffffff">
          ${renderDigitRects(digit)}
        </g>
      `
		})
		.join('\n')

	const svg = `
    <svg width="90" height="90" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="black" flood-opacity="0.6"/>
        </filter>
      </defs>

      <!-- тёмный круг с тенью -->
      <circle cx="45" cy="45" r="26" fill="rgba(0,0,0,0.7)" filter="url(#shadow)"/>

      <!-- цифры (семисегментные) -->
      ${digitsGroups}
    </svg>
  `

	return Buffer.from(svg, 'utf-8')
}

/* ====================== ОСНОВНОЙ КОЛЛАЖ ====================== */

/**
 * Создаёт коллаж из главных фото партий.
 * batches — массив партий для текущей страницы (max 5),
 *   каждый с include: { photos: { where: { isMain: true }, take: 1 } }
 * offset — смещение для глобальной нумерации (стр.2 => 5, стр.3 => 10 и т.д.)
 */
export async function createStockCollage(batches, offset = 0) {
	// берём именно партии страницы (до 5 штук)
	const pageBatches = (batches || []).slice(0, 5)

	// подготовим список партий, у которых есть главная фотка
	const entries = pageBatches
		.map((batch, indexOnPage) => {
			const mainPhoto = batch.photos?.[0]
			if (!mainPhoto || !mainPhoto.url) return null
			return {
				batch,
				photoUrl: mainPhoto.url,
				originalIndex: indexOnPage, // позиция партии на странице (0..4)
			}
		})
		.filter(Boolean)

	if (!entries.length) {
		return null
	}

	// 1) качаем фотки
	const downloaded = await Promise.all(
		entries.map(async entry => {
			try {
				const res = await fetch(entry.photoUrl)
				if (!res.ok) {
					console.error(
						'[collage] fetch failed for',
						entry.photoUrl,
						res.status
					)
					return null
				}
				const arrayBuf = await res.arrayBuffer()
				const buffer = Buffer.from(arrayBuf)
				return { ...entry, buffer }
			} catch (e) {
				console.error('[collage] fetch error', e)
				return null
			}
		})
	)

	const withBuffers = downloaded.filter(e => e && e.buffer)
	if (!withBuffers.length) return null

	// 2) параметры коллажа
	const tileSize = 460
	const cols = 3
	const rows = 2
	const width = cols * tileSize
	const height = rows * tileSize

	// 3) ресайзим каждую фотку до квадрата
	const tilesData = await Promise.all(
		withBuffers.map(async entry => {
			try {
				const resized = await sharp(entry.buffer)
					.resize(tileSize, tileSize, {
						fit: 'cover',
						position: 'centre',
					})
					.jpeg({ quality: 85 })
					.toBuffer()

				return {
					...entry,
					tileBuffer: resized,
				}
			} catch (e) {
				console.error('[collage] resize error', e)
				return null
			}
		})
	)

	const tiles = tilesData.filter(t => t && t.tileBuffer)
	if (!tiles.length) return null

	// 4) собираем composite: фотки + бейджи-номера
	const composites = []

	tiles.forEach((tile, tileIndex) => {
		const col = tileIndex % cols
		const row = Math.floor(tileIndex / cols)

		const left = col * tileSize
		const top = row * tileSize

		// кладём саму фотку
		composites.push({
			input: tile.tileBuffer,
			left,
			top,
		})

		// глобальный номер партии: учитываем offset и исходный индекс партии на странице
		const globalIndex = offset + tile.originalIndex + 1

		// SVG-бейдж без текста, только прямоугольники
		const badgeSvg = makeBadgeSvg(globalIndex)

		composites.push({
			input: badgeSvg,
			left: left + 16,
			top: top + 16,
		})
	})

	// 5) финальный рендер
	const canvas = sharp({
		create: {
			width,
			height,
			channels: 3,
			background: '#000000',
		},
	})

	try {
		const buffer = await canvas
			.composite(composites)
			.jpeg({ quality: 80 })
			.toBuffer()

		return buffer
	} catch (e) {
		console.error('[collage] compose error', e)
		return null
	}
}
