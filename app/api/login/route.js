// app/api/login/route.js

import { NextResponse } from 'next/server'

export async function POST(request) {
	const { password } = await request.json()

	const adminPassword = process.env.ADMIN_PASSWORD

	if (!adminPassword) {
		console.warn('[login] Brak ADMIN_PASSWORD w zmiennych środowiskowych.')
	}

	if (!password || password !== adminPassword) {
		return NextResponse.json({ error: 'Nieprawidłowe hasło.' }, { status: 401 })
	}

	const res = NextResponse.json({ success: true })

	res.cookies.set('admin_auth', '1', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 30, // 30 dni
		path: '/',
		sameSite: 'lax',
	})

	return res
}
