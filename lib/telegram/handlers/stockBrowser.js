// lib/telegram/handlers/stockBrowser.js

import { PANEL_BASE_URL } from '../bot'
import {
	buildBrandModel,
	buildPriceLabel,
	buildSeasonLabel,
	buildSizeLabel,
} from '../helpers/formatting'
import { MAIN_MENU_KEYBOARD } from '../keyboards'
import { createStockCollage } from '../services/collage'

const PAGE_SIZE = 5

export function registerStockBrowserHandlers(bot, prisma) {
	bot.hears('📦 Magazyn (sprzedaż)', async ctx => {
		await sendStockPage(ctx, prisma, 0)
	})

	bot.action(/^stock_page:(init|next|prev)(?::(\d+))?$/, async ctx => {
		try {
			const [, action, pageStr] = ctx.match
			let currentPage = pageStr ? parseInt(pageStr, 10) : 0
			if (Number.isNaN(currentPage) || currentPage < 0) currentPage = 0

			const total = await prisma.tireBatch.count({
				where: { type: 'STOCK' },
			})
			const maxPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0)

			let newPage = currentPage
			if (action === 'next') newPage = Math.min(currentPage + 1, maxPage)
			if (action === 'prev') newPage = Math.max(currentPage - 1, 0)

			if (newPage === currentPage && action !== 'init') {
				await ctx.answerCbQuery(
					newPage === 0
						? 'To jest pierwsza strona.'
						: 'To jest ostatnia strona.'
				)
				return
			}

			await ctx.answerCbQuery()
			await editStockPage(ctx, prisma, newPage, total)
		} catch (err) {
			console.error('[stockBrowser action] error:', err)
			try {
				await ctx.answerCbQuery('Wystąpił błąd.', { show_alert: true })
			} catch {}
		}
	})
}

async function sendStockPage(ctx, prisma, page) {
	const total = await prisma.tireBatch.count({
		where: { type: 'STOCK' },
	})

	if (!total) {
		await ctx.reply(
			'Magazyn (sprzedaż) jest pusty.\n' +
				'Użyj przycisku "➕ Nowa partia", aby dodać pierwszą partię.',
			{ reply_markup: MAIN_MENU_KEYBOARD }
		)
		return
	}

	const maxPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0)
	const currentPage = Math.min(Math.max(page, 0), maxPage)

	const batches = await prisma.tireBatch.findMany({
		where: { type: 'STOCK' },
		include: {
			photos: {
				where: { isMain: true },
				take: 1,
			},
		},
		orderBy: { createdAt: 'desc' },
		skip: currentPage * PAGE_SIZE,
		take: PAGE_SIZE,
	})

	const offset = currentPage * PAGE_SIZE

	const collageBuffer = await createStockCollage(batches, offset)
	const caption = buildStockCaption(batches, currentPage, maxPage, total)
	const keyboard = buildPageKeyboard(currentPage, maxPage)

	await ctx.replyWithPhoto(
		collageBuffer
			? { source: collageBuffer }
			: 'https://via.placeholder.com/800x600?text=Brak+zdjęć',
		{
			caption,
			reply_markup: keyboard,
		}
	)
}

async function editStockPage(ctx, prisma, page, total) {
	const maxPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0)
	const currentPage = Math.min(Math.max(page, 0), maxPage)

	const batches = await prisma.tireBatch.findMany({
		where: { type: 'STOCK' },
		include: {
			photos: {
				where: { isMain: true },
				take: 1,
			},
		},
		orderBy: { createdAt: 'desc' },
		skip: currentPage * PAGE_SIZE,
		take: PAGE_SIZE,
	})

	const offset = currentPage * PAGE_SIZE

	const collageBuffer = await createStockCollage(batches, offset)
	const caption = buildStockCaption(batches, currentPage, maxPage, total)
	const keyboard = buildPageKeyboard(currentPage, maxPage)

	if (collageBuffer) {
		await ctx.editMessageMedia(
			{
				type: 'photo',
				media: { source: collageBuffer },
				caption,
				parse_mode: 'Markdown',
			},
			{
				reply_markup: keyboard,
			}
		)
	} else {
		await ctx.editMessageCaption(caption, {
			parse_mode: 'Markdown',
			reply_markup: keyboard,
		})
	}
}

/**
 * Текст под коллажом
 */
function buildStockCaption(batches, currentPage, maxPage, total) {
	if (!batches.length) {
		return 'Brak partii na tej stronie.'
	}

	let text = `📦 Partie (Magazyn – sprzedaż)\nStrona ${currentPage + 1} z ${
		maxPage + 1
	} (razem: ${total})\n\n`

	batches.forEach((batch, index) => {
		const globalIndex = currentPage * PAGE_SIZE + index + 1

		const sizeLabel = buildSizeLabel(batch) || '—'
		const seasonLabel = buildSeasonLabel(batch.season)
		const brandModel = buildBrandModel(batch)
		const qtyLabel = batch.quantityTotal
			? `${batch.quantityAvailable ?? 0}/${batch.quantityTotal} szt.`
			: `${batch.quantityAvailable ?? 0} szt.`
		const priceLabel = buildPriceLabel(batch)
		const loc = batch.locationCode || '—'
		const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`

		text +=
			`${globalIndex}) ${sizeLabel} | ${seasonLabel} | ${brandModel}\n` +
			`   Ilość: ${qtyLabel}, Cena: ${priceLabel}, Lokalizacja: ${loc}\n` +
			`   Karta: ${panelUrl}\n\n`
	})

	return text
}

/**
 * Клавиатура для страниц
 */
function buildPageKeyboard(currentPage, maxPage) {
	const prevData = `stock_page:prev:${currentPage}`
	const nextData = `stock_page:next:${currentPage}`

	const row = []

	row.push({
		text: '◀️ Poprzednie',
		callback_data: prevData,
	})

	row.push({
		text: `Strona ${currentPage + 1}/${maxPage + 1}`,
		callback_data: 'stock_page:init', // просто перезагружаем текущую при нажатии
	})

	row.push({
		text: '▶️ Następne',
		callback_data: nextData,
	})

	return {
		inline_keyboard: [row],
	}
}
