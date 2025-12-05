// app/api/login/route.js
import { NextResponse } from 'next/server'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD // можно забрать из env

export async function POST(request) {
	try {
		const body = await request.json().catch(() => ({}))
		const { password } = body

		if (!password || password !== ADMIN_PASSWORD) {
			return NextResponse.json(
				{ error: 'Nieprawidłowe hasło' },
				{ status: 401 }
			)
		}

		const res = NextResponse.json({ ok: true })

		// простая cookie, которой будет проверять middleware
		res.cookies.set({
			name: 'storage_admin',
			value: '1',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: 60 * 60 * 24 * 30, // 30 dni
		})

		return res
	} catch (err) {
		console.error('[api/login] error:', err)
		return NextResponse.json(
			{ error: 'Wewnętrzny błąd logowania' },
			{ status: 500 }
		)
	}
}
