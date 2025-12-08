// lib/telegram/services/collage.js

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Регистрируем шрифт для бейджей (один раз на модуль).
 * Шрифт лежит в /fonts/Inter-Bold.ttf относительно корня проекта.
 */
const BADGE_FONT_PATH = path.join(process.cwd(), 'fonts', 'Inter-Bold.ttf')

try {
	const fontBuffer = fs.readFileSync(BADGE_FONT_PATH)
	GlobalFonts.registerFromBuffer(fontBuffer, 'BadgeFont')
	console.log('[collage] BadgeFont registered OK')
} catch (e) {
	console.error('[collage] Cannot register BadgeFont:', e)
}

/**
 * Рисуем бейдж с номером на canvas и возвращаем PNG-буфер.
 */
function renderBadge(number) {
	const size = 90
	const canvas = createCanvas(size, size)
	const ctx = canvas.getContext('2d')

	// чистим холст
	ctx.clearRect(0, 0, size, size)

	// Тень + круг
	ctx.save()
	ctx.shadowColor = 'rgba(0,0,0,0.6)'
	ctx.shadowBlur = 4
	ctx.shadowOffsetX = 0
	ctx.shadowOffsetY = 2

	ctx.beginPath()
	ctx.arc(size / 2, size / 2, 26, 0, Math.PI * 2)
	ctx.fillStyle = 'rgba(0,0,0,0.7)'
	ctx.fill()
	ctx.restore()

	// Текст
	ctx.fillStyle = '#ffffff'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'

	// если шрифт не загрузился – всё равно хоть какой-то системный использует
	ctx.font = '700 28px "BadgeFont"'

	// чуть сдвигаем по Y вниз (визуально приятнее)
	ctx.fillText(String(number), size / 2, size / 2 + 1)

	// Возвращаем PNG-буфер
	return canvas.toBuffer('image/png')
}

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

		// рисуем бейдж через canvas
		const badgePng = renderBadge(globalIndex)

		composites.push({
			input: badgePng,
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
