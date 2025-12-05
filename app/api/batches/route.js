// app/api/batches/route.js

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/batches
 * (если где-то пригодится; сейчас список партий на странице тянем напрямую через prisma)
 */
export async function GET() {
	try {
		const batches = await prisma.tireBatch.findMany({
			include: {
				photos: {
					where: { isMain: true },
					take: 1,
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		})

		return NextResponse.json(batches)
	} catch (error) {
		console.error('[GET /api/batches] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się pobrać partii' },
			{ status: 500 }
		)
	}
}

/**
 * POST /api/batches
 * Przyjmuje JSON (Content-Type: application/json) z CreateBatchForm
 */
export async function POST(request) {
	try {
		// ❗ Раньше было request.formData(), теперь JSON
		const body = await request.json()

		const {
			type = 'STOCK',
			rimDiameter,
			width,
			height,
			season,
			brand = '',
			model = '',
			condition = '',
			quantityTotal,
			quantityAvailable,
			pricePerTire,
			pricePerSet,
			storageOwnerName,
			storageOwnerPhone,
			storageStartedAt,
			storageExpiresAt,
			locationCode = '',
			notes = '',
			productionYear, // 🆕 год выпуска (может быть числом или строкой)
		} = body || {}

		// базовая валидация минимальных полей
		if (!rimDiameter) {
			return NextResponse.json(
				{ error: 'Średnica felgi (R) jest wymagana' },
				{ status: 400 }
			)
		}
		if (!quantityTotal) {
			return NextResponse.json(
				{ error: 'Ilość całkowita jest wymagana' },
				{ status: 400 }
			)
		}

		// нормализация числовых полей
		const rimDiameterNum = rimDiameter ? Number(rimDiameter) : null
		const widthNum = width ? Number(width) : null
		const heightNum = height ? Number(height) : null

		const quantityTotalNum = Number(quantityTotal)
		const quantityAvailableNum = quantityAvailable
			? Number(quantityAvailable)
			: quantityTotalNum

		const pricePerTireNum =
			pricePerTire !== undefined && pricePerTire !== null && pricePerTire !== ''
				? Number(pricePerTire)
				: null
		const pricePerSetNum =
			pricePerSet !== undefined && pricePerSet !== null && pricePerSet !== ''
				? Number(pricePerSet)
				: null

		// 🆕 нормализация и валидация года выпуска
		let productionYearNum = null
		if (
			productionYear !== undefined &&
			productionYear !== null &&
			productionYear !== ''
		) {
			productionYearNum = Number(productionYear)
			if (
				Number.isNaN(productionYearNum) ||
				productionYearNum < 1990 ||
				productionYearNum > 2050
			) {
				return NextResponse.json(
					{ error: 'Nieprawidłowy rok produkcji' },
					{ status: 400 }
				)
			}
		}

		// даты хранения (для STORAGE)
		const storageStartedAtDate =
			storageStartedAt && storageStartedAt !== ''
				? new Date(storageStartedAt)
				: null
		const storageExpiresAtDate =
			storageExpiresAt && storageExpiresAt !== ''
				? new Date(storageExpiresAt)
				: null

		const batch = await prisma.tireBatch.create({
			data: {
				type,
				rimDiameter: rimDiameterNum,
				width: widthNum,
				height: heightNum,
				season: season || null,
				brand,
				model,
				condition,
				quantityTotal: quantityTotalNum,
				quantityAvailable: quantityAvailableNum,
				pricePerTire: pricePerTireNum,
				pricePerSet: pricePerSetNum,
				storageOwnerName: storageOwnerName || null,
				storageOwnerPhone: storageOwnerPhone || null,
				storageStartedAt: storageStartedAtDate,
				storageExpiresAt: storageExpiresAtDate,
				locationCode,
				notes,
				productionYear: productionYearNum, // 🆕 сохраняем год
			},
		})

		return NextResponse.json(batch, { status: 201 })
	} catch (error) {
		console.error('[POST /api/batches] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się utworzyć partii' },
			{ status: 500 }
		)
	}
}
