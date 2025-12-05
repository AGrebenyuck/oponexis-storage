// middleware.js
import { NextResponse } from 'next/server'

export function middleware(req) {
	const { pathname, search } = req.nextUrl

	// Разрешаем эти пути без логина
	if (
		pathname.startsWith('/login') ||
		pathname.startsWith('/api/telegram') ||
		pathname.startsWith('/_next') ||
		pathname === '/favicon.ico'
	) {
		return NextResponse.next()
	}

	// Что считаем защищённым
	const needsAuth = pathname.startsWith('/batches') || pathname === '/' // корень панели и список партий

	if (!needsAuth) {
		return NextResponse.next()
	}

	const session = req.cookies.get('storage_admin')?.value

	if (session === '1') {
		// авторизован — пропускаем
		return NextResponse.next()
	}

	// Не авторизован — кидаем на /login с redirect
	const loginUrl = new URL('/login', req.url)
	loginUrl.searchParams.set('redirect', pathname + (search || ''))
	return NextResponse.redirect(loginUrl)
}

export const config = {
	// ловим всё, кроме статики
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
