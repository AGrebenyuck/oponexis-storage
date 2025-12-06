// lib/telegram/handlers/storageBrowser.js

import { PANEL_BASE_URL } from '../bot'
import {
	buildBrandModel,
	buildPriceLabel,
	buildSeasonLabel,
	buildSizeLabel,
} from '../helpers/formatting'
import { MAIN_MENU_KEYBOARD } from '../keyboards'

export function registerStorageBrowserHandlers(bot, prisma) {
	// Клавиша "📥 Magazyn (przechowanie)" на главной клавиатуре
	bot.hears('📥 Magazyn (przechowanie)', async ctx => {
		try {
			// последние 5 партий ТОЛЬКО STORAGE
			const batches = await prisma.tireBatch.findMany({
				where: { type: 'STORAGE' },
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
				await ctx.reply(
					'Brak partii w przechowaniu.\n' +
						'Użyj przycisku "➕ Nowa partia", aby dodać opony klienta.',
					{ reply_markup: MAIN_MENU_KEYBOARD }
				)
				return
			}

			/* ==== 1) Альбом с превьюшками (если есть фото) ==== */

			const media = []

			batches.forEach((batch, index) => {
				const mainPhoto = batch.photos[0]
				if (!mainPhoto) return

				const sizeLabel = buildSizeLabel(batch) || '—'
				const seasonLabel = buildSeasonLabel(batch.season)
				const brandModel = buildBrandModel(batch)
				const qtyLabel = batch.quantityTotal
					? `${batch.quantityAvailable ?? 0}/${batch.quantityTotal} szt.`
					: `${batch.quantityAvailable ?? 0} szt.`
				const priceLabel = buildPriceLabel(batch)
				const loc = batch.locationCode || '—'
				const owner =
					[batch.storageOwnerName, batch.storageOwnerPhone]
						.filter(Boolean)
						.join(', ') || '—'
				const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`

				const caption =
					`${index + 1}) ${sizeLabel} | ${seasonLabel}\n` +
					`${brandModel}\n` +
					`Ilość: ${qtyLabel}, Cena: ${priceLabel}\n` +
					`Lokalizacja: ${loc}\n` +
					`Właściciel: ${owner}\n` +
					`Karta: ${panelUrl}`

				media.push({
					type: 'photo',
					media: mainPhoto.url,
					caption,
				})
			})

			if (media.length) {
				await ctx.replyWithMediaGroup(media)
			}

			/* ==== 2) Текстовый список 1–5 ==== */

			let text = '🧳 Ostatnie partie w przechowaniu (max 5):\n\n'

			batches.forEach((batch, index) => {
				const sizeLabel = buildSizeLabel(batch) || '—'
				const seasonLabel = buildSeasonLabel(batch.season)
				const brandModel = buildBrandModel(batch)
				const qtyLabel = batch.quantityTotal
					? `${batch.quantityAvailable ?? 0}/${batch.quantityTotal} szt.`
					: `${batch.quantityAvailable ?? 0} szt.`
				const priceLabel = buildPriceLabel(batch)
				const loc = batch.locationCode || '—'
				const owner =
					[batch.storageOwnerName, batch.storageOwnerPhone]
						.filter(Boolean)
						.join(', ') || '—'
				const panelUrl = `${PANEL_BASE_URL}/batches/${batch.id}`

				text +=
					`${index + 1}) ${sizeLabel} | ${seasonLabel} | ${brandModel}\n` +
					`   Ilość: ${qtyLabel}, Cena: ${priceLabel}, Lokalizacja: ${loc}\n` +
					`   Właściciel: ${owner}\n` +
					`   Karta: ${panelUrl}\n\n`
			})

			await ctx.reply(text, {
				reply_markup: MAIN_MENU_KEYBOARD,
			})
		} catch (err) {
			console.error('[storageBrowser] error:', err)
			await ctx.reply(
				'❌ Nie udało się pobrać listy partii w przechowaniu. Spróbuj jeszcze raz później.',
				{ reply_markup: MAIN_MENU_KEYBOARD }
			)
		}
	})
}
