// lib/telegram/keyboards.js

export const MAIN_MENU_KEYBOARD = {
	keyboard: [
		[{ text: '➕ Nowa partia' }],
		[{ text: '📦 Magazyn (sprzedaż)' }, { text: '📥 Magazyn (przechowanie)' }],
		[{ text: '🔍 Szukaj' }],
		[{ text: '✖️ Anuluj' }],
	],
	resize_keyboard: true,
	one_time_keyboard: false, // важно: не прячем после нажатия
}
