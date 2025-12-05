// app/api/telegram/route.js

import { NextResponse } from 'next/server'
import { Telegraf } from 'telegraf'
import { prisma } from '../../../lib/prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const PANEL_BASE_URL = process.env.PANEL_BASE_URL || 'https://example.com'

if (!BOT_TOKEN) {
	throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

// Список разрешённых пользователей (только они могут пользоваться ботом/инлайном)
const ALLOWED_USERS = [
	process.env.TELEGRAM_ADMIN_1,
	process.env.TELEGRAM_ADMIN_2,
]
	.filter(Boolean)
	.map(String)

// Создаём экземпляр Telegraf один раз на модуль
const bot = new Telegraf(BOT_TOKEN, {
	telegram: { webhookReply: true },
})

/* =====================
 * Middleware: допускаем только ALLOWED_USERS
 * ===================== */

bot.use(async (ctx, next) => {
	const uid = ctx.from?.id ? String(ctx.from.id) : null
	if (!uid || !ALLOWED_USERS.includes(uid)) {
		if (ctx.inlineQuery) {
			await ctx.answerInlineQuery([])
		}
		return
	}
	return next()
})

/* =====================
 * 1) /start + клавиатура
 * ===================== */

bot.start(async ctx => {
	await ctx.reply(
		'Cześć! 🤖\n\nTo jest bot magazynu opon Oponexis.\n\n' +
			'Możesz:\n' +
			'• dodać partię opon\n' +
			'• wyszukać dostępne opony (inline)\n' +
			'• podejrzeć magazyn (sprzedaż)\n\n' +
			'Inline: wpisz `@tires 205/55 R16 zima` w dowolnym czacie.',
		{
			parse_mode: 'Markdown',
			reply_markup: {
				keyboard: [
					[{ text: '➕ Nowa partia' }],
					[{ text: '📦 Magazyn (sprzedaż)' }],
					[{ text: '🔍 Szukaj' }],
				],
				resize_keyboard: true,
				one_time_keyboard: false,
			},
		}
	)
})

bot.hears('📦 Magazyn (sprzedaż)', async ctx => {
	await ctx.reply(
		'Tryb: Magazyn (sprzedaż).\n\n' +
			'Do szybkiego wyszukiwania użyj inline: `@tires 205/55 R16 zima`.',
		{ parse_mode: 'Markdown' }
	)
})

bot.hears('🔍 Szukaj', async ctx => {
	await ctx.reply(
		'Aby wyszukać opony, użyj inline w dowolnym czacie:\n\n' +
			'`@tires 205/55 R16 zima`',
		{ parse_mode: 'Markdown' }
	)
})

/* =====================
 * 2) Диалог: создание новой партии
 * ===================== */

/**
 * Старт диалога создания партии
 */
bot.command('nowa', async ctx => {
	await startCreateBatchDialog(ctx)
})

// кнопка на клавиатуре
bot.hears('➕ Nowa partia', async ctx => {
	await startCreateBatchDialog(ctx)
})

async function startCreateBatchDialog(ctx) {
	const telegramUserId = String(ctx.from.id)
	const chatId = String(ctx.chat.id)

	// отключаем старые активные диалоги пользователя
	await prisma.telegramDialog.updateMany({
		where: { telegramUserId, isActive: true },
		data: { isActive: false },
	})

	// создаём новый диалог
	const dialog = await prisma.telegramDialog.create({
		data: {
			telegramUserId,
			chatId,
			mode: 'CREATE_BATCH',
			step: 1,
			data: {}, // пустой объект, будем наполнять
		},
	})

	await ctx.reply(
		'OK, tworzymy nową partię opon.\n\n' + 'Krok 1/9: wybierz typ partii:',
		{
			reply_markup: {
				keyboard: [
					[{ text: 'Magazyn (sprzedaż)' }],
					[{ text: 'Przechowanie klienta' }],
					[{ text: '✖️ Anuluj' }],
				],
				resize_keyboard: true,
				one_time_keyboard: false,
			},
		}
	)

	console.log('[DIALOG] CREATE_BATCH started, id:', dialog.id)
}

/**
 * Универсальный обработчик текстовых сообщений:
 * если есть активный диалог — двигаем по шагам,
 * если нет — просто игнорируем (остальные handlers уже отработают).
 */
bot.on('text', async ctx => {
	const telegramUserId = String(ctx.from.id)
	const chatId = String(ctx.chat.id)
	const text = (ctx.message.text || '').trim()

	// глобальный "анулюй" диалог
	if (text === '✖️ Anuluj' || text.toLowerCase() === '/anuluj') {
		await prisma.telegramDialog.updateMany({
			where: { telegramUserId, isActive: true },
			data: { isActive: false },
		})
		await ctx.reply('Dialog został anulowany.', {
			reply_markup: { remove_keyboard: true },
		})
		return
	}

	// находим активный диалог
	const dialog = await prisma.telegramDialog.findFirst({
		where: { telegramUserId, chatId, isActive: true },
	})

	if (!dialog) {
		// нет активного диалога — выходим, остальной код (hears/command) уже сработал
		return
	}

	if (dialog.mode === 'CREATE_BATCH') {
		await handleCreateBatchStep(ctx, dialog, text)
		return
	}

	// в будущем: if (dialog.mode === 'EDIT_BATCH') ...
})

/**
 * Обработка шагов диалога CREATE_BATCH
 */
async function handleCreateBatchStep(ctx, dialog, text) {
	let data = dialog.data || {}
	let step = dialog.step

	// шаг 1: тип партии
	if (step === 1) {
		let type = null
		if (text === 'Magazyn (sprzedaż)' || text.toLowerCase() === 'magazyn') {
			type = 'STOCK'
		} else if (
			text === 'Przechowanie klienta' ||
			text.toLowerCase().includes('przechowanie')
		) {
			type = 'STORAGE'
		}

		if (!type) {
			await ctx.reply(
				'Proszę wybrać jedną z opcji:\n• Magazyn (sprzedaż)\n• Przechowanie klienta'
			)
			return
		}

		data.type = type
		step = 2

		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply('Krok 2/9: podaj średnicę felgi (R), np. 16, 17, 18.', {
			reply_markup: {
				keyboard: [[{ text: '✖️ Anuluj' }]],
				resize_keyboard: true,
			},
		})
		return
	}

	// шаг 2: диаметр R
	if (step === 2) {
		const n = Number(text)
		if (Number.isNaN(n) || n < 10 || n > 30) {
			await ctx.reply('Nieprawidłowa średnica. Podaj liczbę, np. 16, 17, 18.')
			return
		}
		data.rimDiameter = n
		step = 3

		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 3/9: podaj szerokość i profil w formacie 205/55 (możesz wpisać samo 205 lub pominąć, jeśli nieznane).'
		)
		return
	}

	// шаг 3: ширина/профиль
	if (step === 3) {
		if (text === '-' || text.toLowerCase() === 'brak') {
			data.width = null
			data.height = null
		} else {
			// попробуем распарсить 205/55 или 205.55
			const t = text.replace(',', '.')
			const m = t.match(/(\d{3})\s*[\/.]\s*(\d{2})/)
			if (m) {
				data.width = Number(m[1])
				data.height = Number(m[2])
			} else {
				const w = Number(text)
				if (!Number.isNaN(w) && w >= 100 && w <= 400) {
					data.width = w
					data.height = null
				} else {
					await ctx.reply(
						'Nieprawidłowy format. Przykład: 205/55 lub 205. Możesz też wpisać "-" aby pominąć.'
					)
					return
				}
			}
		}

		step = 4
		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply('Krok 4/9: wybierz sezon:', {
			reply_markup: {
				keyboard: [
					[{ text: 'Lato' }],
					[{ text: 'Zima' }],
					[{ text: 'Całoroczne' }],
					[{ text: 'Pomiń' }],
					[{ text: '✖️ Anuluj' }],
				],
				resize_keyboard: true,
			},
		})
		return
	}

	// шаг 4: сезон
	if (step === 4) {
		let season = null
		if (text === 'Lato') season = 'SUMMER'
		else if (text === 'Zima') season = 'WINTER'
		else if (text === 'Całoroczne') season = 'ALL_SEASON'
		else if (text === 'Pomiń' || text === '-' || text.toLowerCase() === 'brak')
			season = null

		if (season === undefined) {
			await ctx.reply(
				'Proszę wybrać: Lato / Zima / Całoroczne / Pomiń (lub "-").'
			)
			return
		}

		data.season = season
		step = 5

		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 5/9: podaj markę (np. Michelin). Możesz wpisać "-" aby pominąć.'
		)
		return
	}

	// шаг 5: бренд
	if (step === 5) {
		data.brand = text === '-' ? '' : text
		step = 6

		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 6/9: podaj model (np. Pilot Sport 4). Możesz wpisać "-" aby pominąć.'
		)
		return
	}

	// шаг 6: модель
	if (step === 6) {
		data.model = text === '-' ? '' : text
		step = 7

		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 7/9: podaj ilość całkowitą (np. 4). Ilość dostępna będzie domyślnie taka sama.'
		)
		return
	}

	// шаг 7: количество
	if (step === 7) {
		const n = Number(text)
		if (Number.isNaN(n) || n <= 0 || n > 1000) {
			await ctx.reply('Nieprawidłowa ilość. Podaj dodatnią liczbę, np. 4.')
			return
		}
		data.quantityTotal = n
		data.quantityAvailable = n

		step = 8
		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 8/9: podaj cenę (za komplet) w zł, np. 500. Możesz wpisać "-" jeśli nie chcesz teraz podawać.'
		)
		return
	}

	// шаг 8: цена
	if (step === 8) {
		if (text === '-' || text.toLowerCase() === 'brak') {
			data.pricePerSet = null
		} else {
			const n = Number(text)
			if (Number.isNaN(n) || n < 0) {
				await ctx.reply('Nieprawidłowa cena. Podaj liczbę, np. 500 lub "-".')
				return
			}
			data.pricePerSet = n
		}

		step = 9
		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 9/9: podaj rok produkcji (np. 2021) lub "-" jeśli nieznany.'
		)
		return
	}

	// шаг 9: год
	if (step === 9) {
		if (text === '-' || text.toLowerCase() === 'brak') {
			data.productionYear = null
		} else {
			const n = Number(text)
			if (Number.isNaN(n) || n < 1990 || n > 2050) {
				await ctx.reply('Nieprawidłowy rok. Podaj np. 2021 lub "-".')
				return
			}
			data.productionYear = n
		}

		// финал — спросим локализацию и сразу создадим
		step = 10
		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Opcjonalnie: podaj lokalizację na magazynie (np. A-3-2) lub "-" aby pominąć.'
		)
		return
	}

	// шаг 10: локализация и создание партии
	if (step === 10) {
		data.locationCode =
			text === '-' || text.toLowerCase() === 'brak' ? '' : text

		// закрываем диалог
		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: {
				isActive: false,
				data,
			},
		})

		// создаём партию в БД
		try {
			const batch = await prisma.tireBatch.create({
				data: {
					type: data.type || 'STOCK',
					rimDiameter: data.rimDiameter,
					width: data.width,
					height: data.height,
					season: data.season || null,
					brand: data.brand || '',
					model: data.model || '',
					quantityTotal: data.quantityTotal,
					quantityAvailable: data.quantityAvailable,
					pricePerSet: data.pricePerSet !== undefined ? data.pricePerSet : null,
					pricePerTire: null,
					productionYear:
						data.productionYear !== undefined ? data.productionYear : null,
					locationCode: data.locationCode || '',
					notes: 'Dodano przez bota Telegram (dialog).',
				},
			})

			const sizeLabel = buildSizeLabel(batch)
			const seasonLabel = buildSeasonLabel(batch.season)
			const yearLabel = batch.productionYear ? ` (${batch.productionYear})` : ''
			const brandModel = buildBrandModel(batch)
			const qtyLabel = `${batch.quantityAvailable}/${batch.quantityTotal} szt.`
			const priceLabel = buildPriceLabel(batch)

			await ctx.reply(
				'✅ Partia została zapisana.\n\n' +
					`${sizeLabel || 'Rozmiar: —'} | ${seasonLabel}\n` +
					`${brandModel}${yearLabel}\n` +
					`Ilość: ${qtyLabel}\n` +
					`Cena: ${priceLabel}\n` +
					`Lokalizacja: ${batch.locationCode || '—'}\n\n` +
					`Pełna karta: ${PANEL_BASE_URL}/batches/${batch.id}`,
				{
					reply_markup: { remove_keyboard: true },
				}
			)
		} catch (err) {
			console.error('[DIALOG CREATE_BATCH] prisma error:', err)
			await ctx.reply(
				'❌ Wystąpił błąd podczas zapisu partii. Sprawdź logi serwera.',
				{
					reply_markup: { remove_keyboard: true },
				}
			)
		}

		return
	}

	// если по какой-то причине step вышел за рамки — сбросим
	await prisma.telegramDialog.update({
		where: { id: dialog.id },
		data: { isActive: false },
	})
	await ctx.reply(
		'Coś poszło nie tak, dialog został zresetowany. Spróbuj jeszcze raz komendą /nowa.',
		{ reply_markup: { remove_keyboard: true } }
	)
}

/* =====================
 * 3) Inline: только ARTICLE, только STOCK
 * ===================== */

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
			batches = await findRecentStockBatches()
			mode = 'recent_no_query'
		} else {
			parsedSize = parseTireSize(query)
			season = detectSeason(query)
			textQuery = buildTextQuery(query)

			const baseWhere = {
				type: 'STOCK',
			}

			const strictWhere = { ...baseWhere }

			if (parsedSize.rimDiameter)
				strictWhere.rimDiameter = parsedSize.rimDiameter
			if (parsedSize.width) strictWhere.width = parsedSize.width
			if (parsedSize.height) strictWhere.height = parsedSize.height
			if (season) strictWhere.season = season
			if (textQuery) {
				strictWhere.OR = [
					{ brand: { contains: textQuery, mode: 'insensitive' } },
					{ model: { contains: textQuery, mode: 'insensitive' } },
					{ notes: { contains: textQuery, mode: 'insensitive' } },
					{ locationCode: { contains: textQuery, mode: 'insensitive' } },
				]
			}

			if (Object.keys(strictWhere).length > 1) {
				batches = await findStockBatches(strictWhere)
				mode = 'strict'
			}

			if (!batches.length && (season || textQuery)) {
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
					batches = await findStockBatches(looseWhere)
					mode = 'loose'
				}
			}

			if (!batches.length) {
				console.log('[INLINE] no matches for query, returning empty')
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
			const yearLabel = batch.productionYear ? ` (${batch.productionYear})` : ''
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
				[
					sizeLabel,
					seasonLabel,
					brandModel,
					yearShort, // год в заголовке
				]
					.filter(Boolean)
					.join(' | ') || 'Partia opon'

			const messageText =
				`${sizeLabel || 'Rozmiar: —'} | ${seasonLabel}\n` +
				`${brandModel}${yearLabel}\n\n` +
				`Ilość: ${qtyLabel}\n` +
				`Cena: ${priceLabel}\n` +
				`Lokalizacja: ${loc}\n\n` +
				`Pełna karta: ${PANEL_BASE_URL}/batches/${batch.id}`

			results.push({
				type: 'article',
				id: `batch_${batch.id}`,
				title,
				description: `${qtyLabel} · ${priceLabel}${
					batch.productionYear ? ` · ${batch.productionYear}` : ''
				}`,
				input_message_content: {
					message_text: messageText,
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

				summaryText +=
					`${
						idx + 1
					}) ${sizeLabel} | ${seasonLabel} | ${brandModel}${yearLabel}\n` +
					`   Ilość: ${qtyLabel}, Cena: ${priceLabel}, Lokalizacja: ${loc}\n\n`
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

/* =====================
 * Запросы в БД
 * ===================== */

async function findStockBatches(where) {
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

async function findRecentStockBatches() {
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

/* =====================
 * Хелперы парсинга/форматирования
 * ===================== */

// парсим размер из строки: 205/55 R16, 205/55R16, 205.55, R17, 17", либо просто "205" как ширина
function parseTireSize(input) {
	const textRaw = input.toUpperCase().replace(',', '.').trim()

	let text = textRaw.replace(/(\d{3})\.(\d{2})/, '$1/$2')

	const reFull = /(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2})/
	const m1 = text.match(reFull)
	if (m1) {
		return {
			width: Number(m1[1]),
			height: Number(m1[2]),
			rimDiameter: Number(m1[3]),
		}
	}

	const reWH = /(\d{3})\s*\/\s*(\d{2})/
	const mWH = text.match(reWH)

	const reRim = /R\s*(\d{2})|(\d{2})\s*("| CALI|CAL)/
	const mRim = text.match(reRim)

	let width = mWH ? Number(mWH[1]) : null
	let height = mWH ? Number(mWH[2]) : null
	let rimDiameter = mRim ? Number(mRim[1] || mRim[2]) : null

	if (!width && !height && !rimDiameter) {
		const mWidthOnly = text.match(/^\d{3}$/)
		if (mWidthOnly) {
			width = Number(mWidthOnly[0])
		}
	}

	return { width, height, rimDiameter }
}

// вырезаем из запроса размер/сезон, оставляем "человеческий" текст
function buildTextQuery(input) {
	let t = input.toLowerCase()

	t = t.replace(/(\d{3})\s*[\/.]\s*(\d{2})/g, ' ')
	t = t.replace(/\b\d{3}\b/g, ' ')
	t = t.replace(/r\s*\d{2}/g, ' ')
	t = t.replace(/\b(\d{2})\s*(?:\"| cali|cal)\b/g, ' ')
	t = t.replace(/\b(zima|zimowe|lato|letnie|całoroczne|all season)\b/gi, ' ')

	t = t.replace(/\s+/g, ' ').trim()
	return t || null
}

// определяем сезон по словам
function detectSeason(input) {
	const t = input.toLowerCase()
	if (t.includes('zima') || t.includes('zimowe')) return 'WINTER'
	if (t.includes('lato') || t.includes('letnie')) return 'SUMMER'
	if (t.includes('całoroczne') || t.includes('all season')) return 'ALL_SEASON'
	return null
}

function buildSizeLabel(batch) {
	const parts = []
	if (batch.width && batch.height) {
		parts.push(`${batch.width}/${batch.height}`)
	}
	if (batch.rimDiameter) {
		parts.push(`R${batch.rimDiameter}`)
	}
	return parts.join(' ') || null
}

function buildSeasonLabel(season) {
	if (!season) return 'Sezon: —'
	if (season === 'SUMMER') return 'Lato'
	if (season === 'WINTER') return 'Zima'
	if (season === 'ALL_SEASON') return 'Całoroczne'
	return season
}

function buildBrandModel(batch) {
	return [batch.brand, batch.model].filter(Boolean).join(' ') || '—'
}

function buildPriceLabel(batch) {
	if (batch.pricePerSet != null) {
		return `${batch.pricePerSet} zł za komplet`
	}
	if (batch.pricePerTire != null) {
		return `${batch.pricePerTire} zł za szt.`
	}
	return '—'
}

function buildSummaryDescription(parsedSize, season) {
	if (!parsedSize && !season) return 'Filtr: magazyn (sprzedaż)'

	const parts = []
	if (
		parsedSize &&
		parsedSize.width &&
		parsedSize.height &&
		parsedSize.rimDiameter
	) {
		parts.push(
			`${parsedSize.width}/${parsedSize.height} R${parsedSize.rimDiameter}`
		)
	} else if (parsedSize && parsedSize.rimDiameter) {
		parts.push(`R${parsedSize.rimDiameter}`)
	} else if (parsedSize && parsedSize.width) {
		parts.push(`${parsedSize.width}`)
	}
	if (season === 'WINTER') parts.push('zima')
	if (season === 'SUMMER') parts.push('lato')
	if (season === 'ALL_SEASON') parts.push('całoroczne')

	if (!parts.length) return 'Filtr: magazyn (sprzedaż)'
	return parts.join(', ') + ' · magazyn (sprzedaż)'
}

/* =====================
 * Webhook-хэндлер Next.js
 * ===================== */

export const dynamic = 'force-dynamic'

export async function POST(request) {
	try {
		const update = await request.json()
		await bot.handleUpdate(update)
		return NextResponse.json({ ok: true })
	} catch (error) {
		console.error('[Telegram webhook] error:', error)
		return NextResponse.json({ ok: false }, { status: 500 })
	}
}
