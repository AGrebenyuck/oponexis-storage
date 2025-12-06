// lib/telegram/bot.js

import { Telegraf } from 'telegraf'
import { prisma } from '../prisma'
import { registerCreateBatchDialogHandlers } from './handlers/createBatchDialog'
import { registerInlineHandlers } from './handlers/inline'
import { registerStartHandlers } from './handlers/start'
import { registerStockBrowserHandlers } from './handlers/stockBrowser'
import { registerStorageBrowserHandlers } from './handlers/storageBrowser'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) {
	throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

export const PANEL_BASE_URL = process.env.PANEL_BASE_URL

const ALLOWED_USERS = [
	process.env.TELEGRAM_ADMIN_1,
	process.env.TELEGRAM_ADMIN_2,
]
	.filter(Boolean)
	.map(String)

export const bot = new Telegraf(BOT_TOKEN, {
	telegram: { webhookReply: true },
})

// глобальный middleware: пускаем только админов
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

// регистрируем все хэндлеры
registerStartHandlers(bot)
registerCreateBatchDialogHandlers(bot, prisma)
registerInlineHandlers(bot, prisma)
registerStockBrowserHandlers(bot, prisma)
registerStorageBrowserHandlers(bot, prisma)
