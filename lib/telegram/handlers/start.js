// lib/telegram/handlers/start.js

import { MAIN_MENU_KEYBOARD } from '../keyboards'

export function registerStartHandlers(bot) {
	bot.start(async ctx => {
		await ctx.reply(
			'Cześć! 🤖\n\nTo jest bot magazynu opon Oponexis.\n\n' +
				'Możesz:\n' +
				'• dodać partię opon (dialog)\n' +
				'• wyszukać dostępne opony (inline)\n' +
				'• podejrzeć magazyn (sprzedaż) – wkrótce\n\n' +
				'Inline: wpisz `@tires 205/55 R16 zima` w dowolnym czacie.',
			{
				parse_mode: 'Markdown',
				reply_markup: MAIN_MENU_KEYBOARD,
			}
		)
	})
}
