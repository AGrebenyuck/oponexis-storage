// lib/telegram/handlers/createBatchDialog.js

import { cloudinary } from '../../cloudinary'
import { PANEL_BASE_URL } from '../bot'
import {
	buildBrandModel,
	buildPriceLabel,
	buildSeasonLabel,
	buildSizeLabel,
} from '../helpers/formatting'
import { MAIN_MENU_KEYBOARD } from '../keyboards'
import { createStockCollage } from '../services/collage'

export function registerCreateBatchDialogHandlers(bot, prisma) {
	// команда и клавиша для старта диалога
	bot.command('nowa', async ctx => {
		await startCreateBatchDialog(ctx, prisma)
	})

	bot.hears('➕ Nowa partia', async ctx => {
		await startCreateBatchDialog(ctx, prisma)
	})

	bot.hears('🔍 Szukaj', async ctx => {
		await startSearchDialog(ctx, prisma)
	})

	// универсальный обработчик текста в диалоге
	bot.on('text', async (ctx, next) => {
		const telegramUserId = String(ctx.from.id)
		const chatId = String(ctx.chat.id)
		const text = (ctx.message.text || '').trim()

		// глобальный "анулюй"
		if (text === '✖️ Anuluj' || text.toLowerCase() === '/anuluj') {
			await prisma.telegramDialog.updateMany({
				where: { telegramUserId, chatId, isActive: true },
				data: { isActive: false },
			})
			await ctx.reply('Dialog został anulowany.', {
				reply_markup: MAIN_MENU_KEYBOARD,
			})
			return
		}

		const dialog = await prisma.telegramDialog.findFirst({
			where: { telegramUserId, chatId, isActive: true },
		})

		if (!dialog) {
			// это обычное сообщение, без диалога — пускай отработают другие handlers
			return next()
		}

		if (dialog.mode === 'CREATE_BATCH') {
			await handleCreateBatchStep(ctx, prisma, dialog, text)
			return
		}

		if (dialog.mode === 'UPLOAD_PHOTOS') {
			await handleUploadPhotosText(ctx, prisma, dialog, text)
			return
		}

		if (dialog.mode === 'SEARCH') {
			await handleSearchText(ctx, prisma, dialog, text)
			return
		}

		return next()
	})

	// обработка фото в режиме UPLOAD_PHOTOS
	bot.on('photo', async ctx => {
		const telegramUserId = String(ctx.from.id)
		const chatId = String(ctx.chat.id)

		const dialog = await prisma.telegramDialog.findFirst({
			where: { telegramUserId, chatId, isActive: true },
		})

		// работаем только если активен режим UPLOAD_PHOTOS
		if (!dialog || dialog.mode !== 'UPLOAD_PHOTOS') {
			return
		}

		const data = dialog.data || {}
		const batchId = data.batchId
		if (!batchId) return

		try {
			const photos = ctx.message.photo
			if (!photos || !photos.length) return

			// берём самое большое фото из массива
			const largest = photos[photos.length - 1]
			const fileId = largest.file_id

			// ссылка на файл от Telegram
			const fileLink = await ctx.telegram.getFileLink(fileId)
			const fileUrl = fileLink.href || fileLink.toString()

			// проверяем, есть ли уже главная фотка у ЭТОЙ партии
			const existingMain = await prisma.tirePhoto.findFirst({
				where: { batchId, isMain: true },
			})

			// заливаем в Cloudinary
			const uploadResult = await cloudinary.uploader.upload(fileUrl, {
				folder: 'oponexis-tires',
			})

			// создаём запись в tirePhoto
			await prisma.tirePhoto.create({
				data: {
					batchId,
					url: uploadResult.secure_url,
					publicId: uploadResult.public_id,
					isMain: !existingMain, // первая фотка => isMain: true, остальные — false
				},
			})

			await ctx.reply(
				existingMain
					? '✅ Zdjęcie zapisane do tej partii.'
					: '✅ Zdjęcie zapisane jako *główne* tej partii.',
				{ parse_mode: 'Markdown' }
			)
		} catch (err) {
			console.error('[PHOTO UPLOAD] error:', err)
			await ctx.reply(
				'❌ Nie udało się zapisać zdjęcia. Spróbuj jeszcze raz później.'
			)
		}
	})
}

async function startCreateBatchDialog(ctx, prisma) {
	const telegramUserId = String(ctx.from.id)
	const chatId = String(ctx.chat.id)

	await prisma.telegramDialog.updateMany({
		where: { telegramUserId, chatId, isActive: true },
		data: { isActive: false },
	})

	const dialog = await prisma.telegramDialog.create({
		data: {
			telegramUserId,
			chatId,
			mode: 'CREATE_BATCH',
			step: 1,
			data: {},
			isActive: true,
		},
	})

	await ctx.reply(
		'OK, tworzymy nową partię opon.\n\n' + 'Krok 1/10: wybierz typ partii:',
		{
			reply_markup: {
				keyboard: [
					[{ text: 'Magazyn (sprzedaż)' }],
					[{ text: 'Przechowanie klienta' }],
					[{ text: '✖️ Anuluj' }],
				],
				resize_keyboard: true,
			},
		}
	)

	console.log('[DIALOG] CREATE_BATCH started, id:', dialog.id)
}

async function handleCreateBatchStep(ctx, prisma, dialog, text) {
	let data = dialog.data || {}
	let step = dialog.step

	// 1) тип
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

		await ctx.reply('Krok 2/10: podaj średnicę felgi (R), np. 16, 17, 18.', {
			reply_markup: {
				keyboard: [[{ text: '✖️ Anuluj' }]],
				resize_keyboard: true,
			},
		})
		return
	}

	// 2) диаметр
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
			'Krok 3/10: podaj szerokość i profil w formacie 205/55 (możesz wpisać samo 205 lub "-" aby pominąć).'
		)
		return
	}

	// 3) ширина/профиль
	if (step === 3) {
		if (text === '-' || text.toLowerCase() === 'brak') {
			data.width = null
			data.height = null
		} else {
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

		await ctx.reply('Krok 4/10: wybierz sezon:', {
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

	// 4) сезон
	if (step === 4) {
		let season
		if (text === 'Lato') season = 'SUMMER'
		else if (text === 'Zima') season = 'WINTER'
		else if (text === 'Całoroczne') season = 'ALL_SEASON'
		else if (text === 'Pomiń' || text === '-' || text.toLowerCase() === 'brak')
			season = null
		else season = undefined

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
			'Krok 5/10: podaj markę (np. Michelin). Możesz wpisać "-" aby pominąć.'
		)
		return
	}

	// 5) бренд
	if (step === 5) {
		data.brand = text === '-' ? '' : text
		step = 6

		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 6/10: podaj model (np. Pilot Sport 4). Możesz wpisać "-" aby pominąć.'
		)
		return
	}

	// 6) модель
	if (step === 6) {
		data.model = text === '-' ? '' : text
		step = 7

		await prisma.telegramDialog.update({
			where: { id: dialog.id },
			data: { step, data },
		})

		await ctx.reply(
			'Krok 7/10: podaj ilość całkowitą (np. 4). Ilość dostępna będzie domyślnie taka sama.'
		)
		return
	}

	// 7) количество
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
			'Krok 8/10: podaj cenę (za komplet) w zł, np. 500. Możesz wpisać "-" jeśli не chcesz teraz podawać.'
		)
		return
	}

	// 8) цена
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
			'Krok 9/10: podaj rok produkcji (np. 2021) lub "-" jeśli неznany.'
		)
		return
	}

	// 9) год
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

	// 10) локализация + создание партии + переход в режим фоток
	if (step === 10) {
		data.locationCode =
			text === '-' || text.toLowerCase() === 'brak' ? '' : text

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
			const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`

			// переключаем диалог в режим добавления фотографий
			await prisma.telegramDialog.update({
				where: { id: dialog.id },
				data: {
					mode: 'UPLOAD_PHOTOS',
					step: 11,
					isActive: true,
					data: {
						batchId: batch.id,
					},
				},
			})

			await ctx.reply(
				'✅ Partia została zapisana.\n\n' +
					`${sizeLabel || 'Rozmiar: —'} | ${seasonLabel}\n` +
					`${brandModel}${yearLabel}\n` +
					`Ilość: ${qtyLabel}\n` +
					`Cena: ${priceLabel}\n` +
					`Lokalizacja: ${batch.locationCode || '—'}\n\n` +
					`Pełna karta: ${panelUrl}`
			)

			await ctx.reply(
				'Teraz możesz dodać zdjęcia tej partii.\n\n' +
					'• Wyślij zdjęcia jako wiadomości ze zdjęciami (po jednym lub albumem).\n' +
					'• Gdy skończysz, napisz *gotowe* albo *pomiń*.',
				{ parse_mode: 'Markdown' }
			)
		} catch (err) {
			console.error('[DIALOG CREATE_BATCH] prisma error:', err)

			await prisma.telegramDialog.update({
				where: { id: dialog.id },
				data: { isActive: false },
			})

			await ctx.reply(
				'❌ Wystąpił błąd podczas zapisu partii. Sprawdź logi serwera.',
				{
					reply_markup: { remove_keyboard: true },
				}
			)
		}

		return
	}

	// safety fallback
	await prisma.telegramDialog.update({
		where: { id: dialog.id },
		data: { isActive: false },
	})
	await ctx.reply(
		'Coś poszło nie так, dialog został zresetowany. Spróbuj jeszcze raz komendą /nowa.',
		{ reply_markup: MAIN_MENU_KEYBOARD }
	)
}

async function handleUploadPhotosText(ctx, prisma, dialog, text) {
	const telegramUserId = String(ctx.from.id)
	const chatId = String(ctx.chat.id)

	if (/^(gotowe|koniec|pomiń|pomin|brak)$/i.test(text)) {
		await prisma.telegramDialog.updateMany({
			where: { telegramUserId, chatId, isActive: true },
			data: { isActive: false },
		})

		const data = dialog.data || {}
		const batchId = data.batchId
		const panelUrl = batchId ? `${PANEL_BASE_URL}/batches/${batchId}` : null

		await ctx.reply(
			'👍 Zakończono dodawanie zdjęć do tej partii.\n' +
				(panelUrl ? `Karta w panelu: ${panelUrl}` : ''),
			{ reply_markup: MAIN_MENU_KEYBOARD }
		)
		return
	}

	await ctx.reply(
		'Jesteś w trybie dodawania zdjęć do nowej partii.\n\n' +
			'• Wyślij zdjęcia jako wiadomości ze zdjęciami (po jednym lub albumem).\n' +
			'• Gdy skończysz, napisz *gotowe* albo *pomiń*.',
		{ parse_mode: 'Markdown' }
	)
}

async function startSearchDialog(ctx, prisma) {
	const telegramUserId = String(ctx.from.id)
	const chatId = String(ctx.chat.id)

	// выключаем только старые диалоги поиска (CREATE_BATCH и UPLOAD_PHOTOS не трогаем)
	await prisma.telegramDialog.updateMany({
		where: { telegramUserId, chatId, isActive: true, mode: 'SEARCH' },
		data: { isActive: false },
	})

	await prisma.telegramDialog.create({
		data: {
			telegramUserId,
			chatId,
			mode: 'SEARCH',
			step: 1,
			data: {},
			isActive: true,
		},
	})

	await ctx.reply(
		'🔍 Tryb wyszukiwania.\n\n' +
			'Napisz, czego szukasz, np.:\n' +
			'• `205/55 R16 zima`\n' +
			'• `Michelin 17`\n' +
			'• rok, lokalizacja itd.\n\n' +
			'Aby przerwać, naciśnij „✖️ Anuluj”.',
		{
			parse_mode: 'Markdown',
			reply_markup: {
				keyboard: [
					[{ text: '✖️ Anuluj' }],
					...MAIN_MENU_KEYBOARD.keyboard, // основное меню ниже
				],
				resize_keyboard: true,
			},
		}
	)
}

async function handleSearchText(ctx, prisma, dialog, text) {
	const telegramUserId = String(ctx.from.id)
	const chatId = String(ctx.chat.id)
	const q = text.trim()

	if (!q) {
		await ctx.reply(
			'Wpisz proszę frazę do wyszukania (np. `205/55 R16`, `Michelin`, `R18` itd.)',
			{ parse_mode: 'Markdown' }
		)
		return
	}

	const qLower = q.toLowerCase()

	// --- 1. Определяем sezon z tekstu ---
	let seasonFilter = null
	if (qLower.includes('zima') || qLower.includes('zimowe')) {
		seasonFilter = 'WINTER'
	} else if (qLower.includes('lato') || qLower.includes('letnie')) {
		seasonFilter = 'SUMMER'
	} else if (
		qLower.includes('całoroczne') ||
		qLower.includes('caloroczne') ||
		qLower.includes('all season')
	) {
		seasonFilter = 'ALL_SEASON'
	}

	// --- 2. Убираем слова сезона из строки ---
	const qWithoutSeason = qLower
		.replace(
			/\b(zima|zimowe|lato|letnie|całoroczne|caloroczne|all season)\b/g,
			' '
		)
		.trim()

	// --- 3. Если запрос только про сезон ("lato", "zima" и т.п.) ---
	if (seasonFilter && !qWithoutSeason) {
		const whereSeasonOnly = { season: seasonFilter }

		const batches = await prisma.tireBatch.findMany({
			where: whereSeasonOnly,
			include: {
				photos: { where: { isMain: true }, take: 1 },
			},
			orderBy: { createdAt: 'desc' },
			take: 5,
		})

		if (!batches.length) {
			await ctx.reply(`Nic nie znaleziono dla sezonu: "${q}".`, {
				reply_markup: MAIN_MENU_KEYBOARD,
			})
			return
		}

		const offset = 0
		const collageBuffer = await createStockCollage(batches, offset).catch(
			err => {
				console.error('[search season-only] collage error', err)
				return null
			}
		)

		let textResp = `🔍 Wyniki dla sezonu "${q}":\n\n`

		batches.forEach((batch, index) => {
			const sizeLabel = buildSizeLabel(batch) || '—'
			const seasonLabel = buildSeasonLabel(batch.season)
			const brandModel = buildBrandModel(batch)
			const qtyLabel = batch.quantityTotal
				? `${batch.quantityAvailable ?? 0}/${batch.quantityTotal} szt.`
				: `${batch.quantityAvailable ?? 0} szt.`
			const priceLabel = buildPriceLabel(batch)
			const loc = batch.locationCode || '—'
			const typeLabel =
				batch.type === 'STOCK' ? 'Magazyn (sprzedaż)' : 'Przechowanie klienta'
			const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`

			textResp +=
				`${
					index + 1
				}) [${typeLabel}] ${sizeLabel} | ${seasonLabel} | ${brandModel}\n` +
				`   Ilość: ${qtyLabel}, Cena: ${priceLabel}, Lokalizacja: ${loc}\n` +
				`   Karta: ${panelUrl}\n\n`
		})

		if (collageBuffer) {
			if (textResp.length <= 1024) {
				await ctx.replyWithPhoto(
					{ source: collageBuffer },
					{
						caption: textResp,
						reply_markup: MAIN_MENU_KEYBOARD,
					}
				)
			} else {
				await ctx.replyWithPhoto({ source: collageBuffer })
				await ctx.reply(textResp, { reply_markup: MAIN_MENU_KEYBOARD })
			}
		} else {
			await ctx.reply(textResp, { reply_markup: MAIN_MENU_KEYBOARD })
		}

		// SEARCH остаётся активным
		return
	}

	// --- 4. Общий случай: есть ещё что-то кроме сезона ---

	// Парсим размер: вытаскиваем width/height/rim из всей строки, типа "205/55 r17 lato"
	const parsed = parseTireSizeForSearch(q) // { width, height, rimDiameter }
	const hasFullSize = parsed.width && parsed.height

	const where = {}
	const AND = []
	const OR = []

	if (seasonFilter) {
		AND.push({ season: seasonFilter })
	}

	if (hasFullSize) {
		// 🔒 РЕЖИМ СТРОГОГО РАЗМЕРА: 205/55 → width=205 И height=55 (и rim, если есть)
		AND.push({ width: parsed.width }, { height: parsed.height })
		if (parsed.rimDiameter) {
			AND.push({ rimDiameter: parsed.rimDiameter })
		}

		if (AND.length) {
			where.AND = AND
		}

		// В строгом режиме НЕ добавляем "широкие" OR по числам,
		// чтобы не ловить 205/65 и любые R17 и т.п.
	} else {
		// 😌 МЯГКИЙ РЕЖИМ — нет полного размера, ищем как раньше, но аккуратнее

		const cleanedTokens = qWithoutSeason
			.replace(/[\/.,]/g, ' ')
			.split(/\s+/)
			.map(t => t.trim())
			.filter(Boolean)

		for (const token of cleanedTokens) {
			const num = Number(token)

			if (!Number.isNaN(num)) {
				OR.push(
					{ rimDiameter: num },
					{ width: num },
					{ height: num },
					{ productionYear: num }
				)
			} else if (token.length >= 2) {
				OR.push(
					{ brand: { contains: token, mode: 'insensitive' } },
					{ model: { contains: token, mode: 'insensitive' } },
					{ notes: { contains: token, mode: 'insensitive' } },
					{ locationCode: { contains: token, mode: 'insensitive' } }
				)
			}
		}

		// плюс поиск по всей строке, как fallback
		OR.push(
			{ brand: { contains: q, mode: 'insensitive' } },
			{ model: { contains: q, mode: 'insensitive' } },
			{ notes: { contains: q, mode: 'insensitive' } },
			{ locationCode: { contains: q, mode: 'insensitive' } }
		)

		if (OR.length) where.OR = OR
		if (seasonFilter) where.season = seasonFilter
	}

	const batches = await prisma.tireBatch.findMany({
		where,
		include: {
			photos: {
				where: { isMain: true },
				take: 1,
			},
		},
		orderBy: { createdAt: 'desc' },
		take: 5,
	})

	if (!batches.length) {
		await ctx.reply(`Nic nie znaleziono dla: "${q}".`, {
			reply_markup: MAIN_MENU_KEYBOARD,
		})
		// SEARCH оставляем активным — можно сразу ввести другой запрос
		return
	}

	const offset = 0
	const collageBuffer = await createStockCollage(batches, offset).catch(err => {
		console.error('[search] collage error', err)
		return null
	})

	let textResp = `🔍 Wyniki wyszukiwania (max 5) dla: "${q}":\n\n`

	batches.forEach((batch, index) => {
		const sizeLabel = buildSizeLabel(batch) || '—'
		const seasonLabel = buildSeasonLabel(batch.season)
		const brandModel = buildBrandModel(batch)
		const qtyLabel = batch.quantityTotal
			? `${batch.quantityAvailable ?? 0}/${batch.quantityTotal} szt.`
			: `${batch.quantityAvailable ?? 0} szt.`
		const priceLabel = buildPriceLabel(batch)
		const loc = batch.locationCode || '—'
		const typeLabel =
			batch.type === 'STOCK' ? 'Magazyn (sprzedaż)' : 'Przechowanie klienta'
		const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`

		textResp +=
			`${
				index + 1
			}) [${typeLabel}] ${sizeLabel} | ${seasonLabel} | ${brandModel}\n` +
			`   Ilość: ${qtyLabel}, Cena: ${priceLabel}, Lokalizacja: ${loc}\n` +
			`   Karta: ${panelUrl}\n\n`
	})

	if (collageBuffer) {
		if (textResp.length <= 1024) {
			await ctx.replyWithPhoto(
				{ source: collageBuffer },
				{
					caption: textResp,
					reply_markup: MAIN_MENU_KEYBOARD,
				}
			)
		} else {
			await ctx.replyWithPhoto({ source: collageBuffer })
			await ctx.reply(textResp, { reply_markup: MAIN_MENU_KEYBOARD })
		}
	} else {
		await ctx.reply(textResp, {
			reply_markup: MAIN_MENU_KEYBOARD,
		})
	}
}

function parseTireSizeForSearch(raw) {
	if (!raw) return { width: null, height: null, rimDiameter: null }

	const s = raw.replace(',', '.').toLowerCase()

	let width = null
	let height = null
	let rimDiameter = null

	// 205/55, 205.55, 205\55, 205 / 55, 205./55 и т.п.
	const fullMatch = s.match(/(\d{3})\s*[/\\.,]\s*(\d{2})/)
	if (fullMatch) {
		width = Number(fullMatch[1])
		height = Number(fullMatch[2])
	}

	// r17, r 17, R 18
	const rimMatch = s.match(/r\s*([0-9]{2})/)
	if (rimMatch) {
		rimDiameter = Number(rimMatch[1])
	} else {
		// если нет явного "r17", попробуем вытащить последнюю 2-значную цифру как радиус
		const allNums = Array.from(s.matchAll(/\b(\d{2})\b/g)).map(m =>
			Number(m[1])
		)
		const candidate = allNums.find(n => n >= 10 && n <= 30)
		if (candidate) rimDiameter = candidate
	}

	return { width, height, rimDiameter }
}
