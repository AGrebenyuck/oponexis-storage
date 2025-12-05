// middleware.js
import { NextResponse } from 'next/server'

export function middleware(req) {
	const { pathname } = req.nextUrl

	// защищаем только страницы админки
	const isProtected = pathname.startsWith('/batches')

	if (!isProtected) {
		return NextResponse.next()
	}

	const auth = req.cookies.get('admin_auth')?.value

	if (auth === '1') {
		return NextResponse.next()
	}

	const loginUrl = new URL('/login', req.url)
	loginUrl.searchParams.set('from', pathname)
	return NextResponse.redirect(loginUrl)
}

export const config = {
	matcher: ['/batches/:path*'],
}
