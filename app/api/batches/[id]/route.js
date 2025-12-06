// app/api/batches/[id]/route.js

import { NextResponse } from 'next/server'
import { cloudinary } from '../../../../lib/cloudinary'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

// вспомогательная функция: достать public_id из URL, если его нет в БД
function extractPublicIdFromUrl(url) {
	try {
		const [_, afterUpload] = url.split('/upload/')
		if (!afterUpload) return null

		const parts = afterUpload.split('/')
		const withoutVersion = parts.slice(1).join('/')
		const withoutExt = withoutVersion.replace(/\.[^/.]+$/, '')
		return withoutExt || null
	} catch {
		return null
	}
}

// DELETE /api/batches/:id → usuń partię + zdjęcia (Cloudinary)
export async function DELETE(_request, { params }) {
	const { id } = await params

	try {
		const batch = await prisma.tireBatch.findUnique({
			where: { id },
			include: {
				photos: true,
			},
		})

		if (!batch) {
			return NextResponse.json(
				{ error: 'Partia opon nie istnieje.' },
				{ status: 404 }
			)
		}

		// 1) próbujemy usunąć wszystkie zdjęcia z Cloudinary
		if (batch.photos && batch.photos.length > 0) {
			for (const photo of batch.photos) {
				let publicId = photo.publicId
				if (!publicId && photo.url) {
					publicId = extractPublicIdFromUrl(photo.url)
				}

				if (publicId) {
					try {
						await cloudinary.uploader.destroy(publicId)
					} catch (err) {
						console.error(
							'[Cloudinary destroy in batch DELETE] error for',
							publicId,
							err
						)
						// не прерываем — продолжаем удалять остальные
					}
				}
			}
		}

		// 2) usuwamy partię z bazy (zdjęcia i ruchy powinny mieć onDelete: Cascade)
		await prisma.tireBatch.delete({
			where: { id },
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('[DELETE /api/batches/:id] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się usunąć partii.' },
			{ status: 500 }
		)
	}
}

export async function PATCH(request, { params }) {
	// 🔹 то же самое здесь
	const { id } = await params

	if (!id) {
		return NextResponse.json(
			{ ok: false, error: 'Brak ID partii w adresie URL' },
			{ status: 400 }
		)
	}

	try {
		const body = await request.json()

		const {
			type,
			season,
			brand,
			model,
			productionYear,
			pricePerSet,
			pricePerTire,
			locationCode,
			storageOwnerName,
			storageOwnerPhone,
			notes,
		} = body || {}

		const productionYearNum =
			productionYear === '' || productionYear == null
				? null
				: Number(productionYear)

		const pricePerSetNum =
			pricePerSet === '' || pricePerSet == null ? null : Number(pricePerSet)

		const pricePerTireNum =
			pricePerTire === '' || pricePerTire == null ? null : Number(pricePerTire)

		if (productionYearNum !== null && Number.isNaN(productionYearNum)) {
			return NextResponse.json(
				{ ok: false, error: 'Nieprawidłowy rok produkcji' },
				{ status: 400 }
			)
		}

		if (pricePerSetNum !== null && Number.isNaN(pricePerSetNum)) {
			return NextResponse.json(
				{ ok: false, error: 'Nieprawidłowa cena za komplet' },
				{ status: 400 }
			)
		}

		if (pricePerTireNum !== null && Number.isNaN(pricePerTireNum)) {
			return NextResponse.json(
				{ ok: false, error: 'Nieprawidłowa cena za sztukę' },
				{ status: 400 }
			)
		}

		const updated = await prisma.tireBatch.update({
			where: { id: String(id) },
			data: {
				type: type || undefined,
				season: season === '' ? null : season || undefined,
				brand: brand ?? undefined,
				model: model ?? undefined,
				productionYear: productionYearNum,
				pricePerSet: pricePerSetNum,
				pricePerTire: pricePerTireNum,
				locationCode: locationCode ?? undefined,
				storageOwnerName:
					storageOwnerName === '' ? null : storageOwnerName ?? undefined,
				storageOwnerPhone:
					storageOwnerPhone === '' ? null : storageOwnerPhone ?? undefined,
				notes: notes ?? undefined,
			},
		})

		return NextResponse.json({ ok: true, batch: updated }, { status: 200 })
	} catch (err) {
		console.error('[PATCH /api/batches/[id]] error:', err)
		return NextResponse.json(
			{ ok: false, error: err?.message || 'Update failed (server error)' },
			{ status: 500 }
		)
	}
}
