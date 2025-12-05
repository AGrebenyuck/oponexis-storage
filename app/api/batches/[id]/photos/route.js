// app/api/batches/[id]/photos/route.js

import { NextResponse } from 'next/server'
import { cloudinary } from '../../../../../lib/cloudinary'
import { prisma } from '../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

// ✅ список всех zdjęć dla partii
export async function GET(_request, { params }) {
	const { id } = await params

	try {
		const photos = await prisma.tirePhoto.findMany({
			where: { batchId: id },
			orderBy: { createdAt: 'desc' },
		})

		return NextResponse.json(photos)
	} catch (error) {
		console.error('[GET /api/batches/:id/photos] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się pobrać zdjęć.' },
			{ status: 500 }
		)
	}
}

// ✅ przesyłanie zdjęcia (как мы уже чинили)
export async function POST(request, { params }) {
	const { id } = await params

	try {
		if (!id) {
			return NextResponse.json(
				{ error: 'Brak identyfikatora partii (id).' },
				{ status: 400 }
			)
		}

		const batch = await prisma.tireBatch.findUnique({
			where: { id },
		})

		if (!batch) {
			return NextResponse.json(
				{ error: 'Partia opon nie istnieje.' },
				{ status: 404 }
			)
		}

		const formData = await request.formData()
		const file = formData.get('file')

		if (!file) {
			return NextResponse.json(
				{ error: 'Brak pliku do przesłania.' },
				{ status: 400 }
			)
		}

		const bytes = await file.arrayBuffer()
		const buffer = Buffer.from(bytes)

		const folder = process.env.CLOUDINARY_FOLDER || 'oponexis_tires'

		const uploadResult = await new Promise((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{
					folder,
					resource_type: 'image',
				},
				(error, result) => {
					if (error) return reject(error)
					resolve(result)
				}
			)

			stream.end(buffer)
		})

		const existingMain = await prisma.tirePhoto.findFirst({
			where: { batchId: id, isMain: true },
		})

		const photo = await prisma.tirePhoto.create({
			data: {
				batchId: id,
				url: uploadResult.secure_url,
				publicId: uploadResult.public_id, // ← вот это главное
				isMain: existingMain ? false : true,
			},
		})

		await prisma.tireBatch.update({
			where: { id },
			data: { photoNeedsUpdate: false },
		})

		return NextResponse.json(photo, { status: 201 })
	} catch (error) {
		console.error('[POST /api/batches/:id/photos] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się przesłać zdjęcia.' },
			{ status: 500 }
		)
	}
}
