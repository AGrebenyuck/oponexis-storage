// app/api/telegram/route.js

import { NextResponse } from 'next/server'
import { bot } from '../../../lib/telegram/bot'

export const runtime = 'nodejs'
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
