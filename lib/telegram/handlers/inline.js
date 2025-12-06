// lib/telegram/handlers/inline.js

import { PANEL_BASE_URL } from '../bot'
import {
	buildBrandModel,
	buildPriceLabel,
	buildSeasonLabel,
	buildSizeLabel,
	buildSummaryDescription,
} from '../helpers/formatting'
import { buildTextQuery, detectSeason, parseTireSize } from '../helpers/parsing'

export function registerInlineHandlers(bot, prisma) {
	/* ============ inline_query ============ */

	bot.on('inline_query', async ctx => {
		const query = (ctx.inlineQuery.query || '').trim()
		console.log('[INLINE] query:', query)

		try {
			let batches = []
			let parsedSize = null
			let season = null
			let textQuery = null
			let mode = 'recent'

			if (!query) {
				// без строки — просто последние партии на продажу
				batches = await findRecentStockBatches(prisma)
				mode = 'recent_no_query'
			} else {
				parsedSize = parseTireSize(query) // { width, height, rimDiameter }
				season = detectSeason(query) // 'SUMMER' | 'WINTER' | 'ALL_SEASON' | null
				textQuery = buildTextQuery(query) // текст для бренда/модели/локации
				const hasFullSize = !!(parsedSize.width && parsedSize.height)

				const baseWhere = {
					type: 'STOCK',
				}

				const strictWhere = { ...baseWhere }
				let hasStrictFilter = false

				if (parsedSize.rimDiameter) {
					strictWhere.rimDiameter = parsedSize.rimDiameter
					hasStrictFilter = true
				}
				if (parsedSize.width) {
					strictWhere.width = parsedSize.width
					hasStrictFilter = true
				}
				if (parsedSize.height) {
					strictWhere.height = parsedSize.height
					hasStrictFilter = true
				}
				if (season) {
					strictWhere.season = season
					hasStrictFilter = true
				}
				if (textQuery) {
					strictWhere.OR = [
						{ brand: { contains: textQuery, mode: 'insensitive' } },
						{ model: { contains: textQuery, mode: 'insensitive' } },
						{ notes: { contains: textQuery, mode: 'insensitive' } },
						{ locationCode: { contains: textQuery, mode: 'insensitive' } },
					]
					hasStrictFilter = true
				}

				// ---- 1) СТРОГИЙ режим (если есть хоть какие-то фильтры помимо type) ----
				if (hasStrictFilter) {
					batches = await findStockBatches(prisma, strictWhere)
					mode = 'strict'
				}

				// ---- 2) Ничего не нашли в строгом режиме ----
				if (!batches.length) {
					// 👉 Если есть ПОЛНЫЙ размер (205/55) — НЕ делаем "loose" fallback
					//    Чтобы не ловить 255/55 R17 lato, если просили 205/55 R17 lato.
					if (hasFullSize) {
						console.log(
							'[INLINE] strict full-size, no matches — returning empty'
						)
						await ctx.answerInlineQuery([], { cache_time: 1 })
						return
					}

					// 👉 Если полного размера нет, но есть сезон/текст — можно ослабить поиск
					if (season || textQuery) {
						const looseWhere = { ...baseWhere }
						if (season) looseWhere.season = season
						if (textQuery) {
							looseWhere.OR = [
								{ brand: { contains: textQuery, mode: 'insensitive' } },
								{ model: { contains: textQuery, mode: 'insensitive' } },
								{ notes: { contains: textQuery, mode: 'insensitive' } },
								{ locationCode: { contains: textQuery, mode: 'insensitive' } },
							]
						}

						if (Object.keys(looseWhere).length > 1) {
							batches = await findStockBatches(prisma, looseWhere)
							mode = 'loose'
						}
					}
				}

				if (!batches.length) {
					console.log(
						'[INLINE] no matches for query, returning empty (after strict/loose)'
					)
					await ctx.answerInlineQuery([], { cache_time: 1 })
					return
				}
			}

			console.log('[INLINE] mode:', mode, 'batches found:', batches.length)

			if (!batches.length) {
				await ctx.answerInlineQuery([], { cache_time: 1 })
				return
			}

			const results = []
			let totalAvailable = 0

			for (const batch of batches) {
				totalAvailable += batch.quantityAvailable || 0

				const sizeLabel = buildSizeLabel(batch)
				const seasonLabel = buildSeasonLabel(batch.season)
				const yearLabel = batch.productionYear
					? ` (${batch.productionYear})`
					: ''
				const yearShort = batch.productionYear
					? `rok ${batch.productionYear}`
					: null
				const brandModel = buildBrandModel(batch)

				const qtyLabel = batch.quantityTotal
					? `${batch.quantityAvailable ?? 0}/${batch.quantityTotal} szt.`
					: `${batch.quantityAvailable ?? 0} szt.`

				const priceLabel = buildPriceLabel(batch)
				const loc = batch.locationCode || '—'

				const title =
					[sizeLabel, seasonLabel, brandModel, yearShort]
						.filter(Boolean)
						.join(' | ') || 'Partia opon'

				const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`
				const mainPhoto = batch.photos?.[0]

				let messageText =
					`${sizeLabel || 'Rozmiar: —'} | ${seasonLabel}\n` +
					`${brandModel}${yearLabel}\n\n` +
					`Ilość: ${qtyLabel}\n` +
					`Cena: ${priceLabel}\n` +
					`Lokalizacja: ${loc}\n\n` +
					`Pełna karta: ${panelUrl}`

				if (mainPhoto?.url) {
					messageText = `${mainPhoto.url}\n\n` + messageText
				}

				results.push({
					type: 'article',
					id: `batch_${batch.id}`,
					title,
					description: `${qtyLabel} · ${priceLabel}${
						batch.productionYear ? ` · ${batch.productionYear}` : ''
					}`,
					input_message_content: {
						message_text: messageText,
						parse_mode: 'Markdown',
					},
					thumb_url: mainPhoto?.url || undefined,
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: '📋 Otwórz w panelu',
									url: panelUrl,
								},
							],
						],
					},
				})
			}

			if (batches.length > 1) {
				const summaryTitle = `${batches.length} partii – ${totalAvailable} opon`
				let summaryText = `${summaryTitle}`

				if (query) {
					summaryText += ` pasujących do "${query}" (tryb: ${mode}, tylko sprzedaż):\n\n`
				} else {
					summaryText += ` (ostatnie partie, tylko sprzedaż):\n\n`
				}

				batches.forEach((batch, idx) => {
					const sizeLabel = buildSizeLabel(batch) || '—'
					const seasonLabel = buildSeasonLabel(batch.season)
					const brandModel = buildBrandModel(batch)
					const yearLabel = batch.productionYear
						? ` (${batch.productionYear})`
						: ''
					const qtyLabel = batch.quantityTotal
						? `${batch.quantityAvailable ?? 0}/${batch.quantityTotal} szt.`
						: `${batch.quantityAvailable ?? 0} szt.`
					const priceLabel = buildPriceLabel(batch)
					const loc = batch.locationCode || '—'
					const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`

					summaryText +=
						`${
							idx + 1
						}) ${sizeLabel} | ${seasonLabel} | ${brandModel}${yearLabel}\n` +
						`   Ilość: ${qtyLabel}, Cena: ${priceLabel}, Lokalizacja: ${loc}\n` +
						`   Karta: ${panelUrl}\n\n`
				})

				summaryText += `Razem: ${totalAvailable} opon`

				results.push({
					type: 'article',
					id: `summary_${Date.now()}`,
					title: summaryTitle,
					description: buildSummaryDescription(parsedSize, season),
					input_message_content: {
						message_text: summaryText,
					},
				})
			}

			console.log('[INLINE] results prepared:', results.length)

			await ctx.answerInlineQuery(results, {
				cache_time: 1,
			})

			console.log('[INLINE] answerInlineQuery sent')
		} catch (error) {
			console.error('[INLINE] error:', error)
			try {
				await ctx.answerInlineQuery([], { cache_time: 1 })
			} catch (e2) {
				console.error('[INLINE] error on fallback answer:', e2)
			}
		}
	})

	/* ============ callback: 📷 Zdjęcia ============ */

	bot.action(/^photos:(.+)$/, async ctx => {
		try {
			const batchId = ctx.match[1]

			const batch = await prisma.tireBatch.findUnique({
				where: { id: batchId },
				include: {
					photos: {
						orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }],
					},
				},
			})

			if (!batch || !batch.photos.length) {
				await ctx.answerCbQuery('Brak zdjęć dla tej partii.', {
					show_alert: true,
				})
				return
			}

			await ctx.answerCbQuery()

			const media = batch.photos.slice(0, 10).map((photo, idx) => ({
				type: 'photo',
				media: photo.url,
				caption:
					idx === 0 ? buildSizeLabel(batch) || 'Zdjęcie partii' : undefined,
			}))

			await ctx.replyWithMediaGroup(media)
		} catch (err) {
			console.error('[INLINE photos] error:', err)
			try {
				await ctx.answerCbQuery('Błąd podczas pobierania zdjęć.', {
					show_alert: true,
				})
			} catch {}
		}
	})

	/* ============ callback: ➕ Dodaj zdjęcia ============ */

	bot.action(/^add_photos:(.+)$/, async ctx => {
		try {
			const batchId = ctx.match[1]

			const batch = await prisma.tireBatch.findUnique({
				where: { id: batchId },
				select: { id: true },
			})

			if (!batch) {
				await ctx.answerCbQuery('Ta partia nie istnieje.', {
					show_alert: true,
				})
				return
			}

			const telegramUserId = String(ctx.from.id)
			const chatId = String(ctx.chat.id)

			await prisma.telegramDialog.updateMany({
				where: { telegramUserId, chatId, isActive: true },
				data: { isActive: false },
			})

			await prisma.telegramDialog.create({
				data: {
					telegramUserId,
					chatId,
					mode: 'UPLOAD_PHOTOS',
					step: 1,
					isActive: true,
					data: {
						batchId: batch.id,
					},
				},
			})

			await ctx.answerCbQuery()

			await ctx.reply(
				'✅ Tryb dodawania zdjęć.\n\n' +
					'Wyślij teraz zdjęcia tej partii (pojedynczo lub jako album).\n' +
					'Gdy skończysz, napisz *gotowe*.',
				{ parse_mode: 'Markdown' }
			)
		} catch (err) {
			console.error('[add_photos] error:', err)
			try {
				await ctx.answerCbQuery('Wystąpił błąd.', { show_alert: true })
			} catch {}
		}
	})
}

/* ===== запросы в БД ===== */

async function findStockBatches(prisma, where) {
	return prisma.tireBatch.findMany({
		where,
		include: {
			photos: {
				where: { isMain: true },
				take: 1,
			},
		},
		orderBy: {
			createdAt: 'desc',
		},
		take: 10,
	})
}

async function findRecentStockBatches(prisma) {
	return prisma.tireBatch.findMany({
		where: {
			type: 'STOCK',
		},
		include: {
			photos: {
				where: { isMain: true },
				take: 1,
			},
		},
		orderBy: {
			createdAt: 'desc',
		},
		take: 10,
	})
}
