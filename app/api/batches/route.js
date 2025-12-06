// app/api/batches/[id]/route.js

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

// если нужно, можно добавить:
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
	const { id } = params || {}

	if (!id) {
		return NextResponse.json(
			{ ok: false, error: 'Brak ID partii w adresie URL' },
			{ status: 400 }
		)
	}

	try {
		const batch = await prisma.tireBatch.findUnique({
			where: { id: String(id) },
			include: {
				photos: {
					orderBy: { createdAt: 'desc' },
				},
				movements: {
					orderBy: { createdAt: 'desc' },
					take: 20,
				},
			},
		})

		if (!batch) {
			return NextResponse.json(
				{ ok: false, error: 'Partia nie została znaleziona' },
				{ status: 404 }
			)
		}

		return NextResponse.json({ ok: true, batch }, { status: 200 })
	} catch (err) {
		console.error('[GET /api/batches/[id]] error:', err)
		return NextResponse.json(
			{ ok: false, error: err?.message || 'Server error' },
			{ status: 500 }
		)
	}
}
