// app/api/photos/[photoId]/route.js

import { NextResponse } from 'next/server'
import { cloudinary } from '../../../../lib/cloudinary'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

function extractPublicIdFromUrl(url) {
	try {
		// пример URL:
		// https://res.cloudinary.com/<cloud>/image/upload/v1764776071/oponexis_tires/h2dl1whba3knruz7satk.jpg
		const [_, afterUpload] = url.split('/upload/')
		if (!afterUpload) return null

		const parts = afterUpload.split('/')
		// parts[0] = v1764776071, остальное = папки + имя файла
		const withoutVersion = parts.slice(1).join('/') // "oponexis_tires/h2dl1whba3knruz7satk.jpg"
		const withoutExt = withoutVersion.replace(/\.[^/.]+$/, '') // убираем .jpg/.png и т.п.
		return withoutExt || null
	} catch {
		return null
	}
}

// PATCH /api/photos/:photoId  → ustaw jako główne
export async function PATCH(request, { params }) {
	const { photoId } = await params

	try {
		const photo = await prisma.tirePhoto.findUnique({
			where: { id: photoId },
		})

		if (!photo) {
			return NextResponse.json(
				{ error: 'Zdjęcie nie istnieje.' },
				{ status: 404 }
			)
		}

		// снимаем флаг isMain со всех zdjęć tej partii
		await prisma.tirePhoto.updateMany({
			where: { batchId: photo.batchId },
			data: { isMain: false },
		})

		const updated = await prisma.tirePhoto.update({
			where: { id: photoId },
			data: { isMain: true },
		})

		return NextResponse.json(updated)
	} catch (error) {
		console.error('[PATCH /api/photos/:photoId] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się zaktualizować zdjęcia.' },
			{ status: 500 }
		)
	}
}

// DELETE /api/photos/:photoId → usuń zdjęcie (Cloudinary + DB + aktualizacja głównego)
export async function DELETE(_request, { params }) {
	const { photoId } = await params

	try {
		const photo = await prisma.tirePhoto.findUnique({
			where: { id: photoId },
		})

		if (!photo) {
			return NextResponse.json(
				{ error: 'Zdjęcie nie istnieje.' },
				{ status: 404 }
			)
		}

		const batchId = photo.batchId
		const wasMain = photo.isMain

		// 1) próbujemy usunąć plik z Cloudinary
		let publicId = photo.publicId
		if (!publicId && photo.url) {
			publicId = extractPublicIdFromUrl(photo.url)
		}

		if (publicId) {
			try {
				await cloudinary.uploader.destroy(publicId)
			} catch (err) {
				console.error('[Cloudinary destroy] error:', err)
				// не падаем, даже если Cloudinary не удалил — всё равно чистим БД
			}
		}

		// 2) usuwamy zapis z bazy
		await prisma.tirePhoto.delete({
			where: { id: photoId },
		})

		// 3) sprawdzamy, czy są jeszcze zdjęcia tej partii
		const remainingPhotos = await prisma.tirePhoto.findMany({
			where: { batchId },
			orderBy: { createdAt: 'desc' },
		})

		if (remainingPhotos.length === 0) {
			// żadnego zdjęcia – oznaczamy partię jako wymagającą nowych zdjęć
			await prisma.tireBatch.update({
				where: { id: batchId },
				data: { photoNeedsUpdate: true },
			})
		} else if (wasMain) {
			// główne zdjęcie zostało usunięte → wybieramy nowe główne
			const newMain = remainingPhotos[0]

			await prisma.tirePhoto.updateMany({
				where: { batchId },
				data: { isMain: false },
			})

			await prisma.tirePhoto.update({
				where: { id: newMain.id },
				data: { isMain: true },
			})

			// у партии точно есть актуальное foto
			await prisma.tireBatch.update({
				where: { id: batchId },
				data: { photoNeedsUpdate: false },
			})
		}

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('[DELETE /api/photos/:photoId] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się usunąć zdjęcia.' },
			{ status: 500 }
		)
	}
}
