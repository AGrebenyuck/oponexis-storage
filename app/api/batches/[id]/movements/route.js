// app/api/batches/[id]/movements/route.js

import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
	const { id } = await params

	try {
		const body = await request.json()
		const { type, amount, reason } = body

		const parsedAmount = Number(amount)

		if (!type || !['IN', 'OUT', 'SCRAP', 'MOVE'].includes(type)) {
			return NextResponse.json(
				{ error: 'Nieprawidłowy typ ruchu (IN / OUT / SCRAP / MOVE).' },
				{ status: 400 }
			)
		}

		if (!parsedAmount || parsedAmount <= 0) {
			return NextResponse.json(
				{ error: 'Ilość musi być dodatnią liczbą.' },
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

		let newQuantityAvailable = batch.quantityAvailable

		if (type === 'IN') {
			newQuantityAvailable = batch.quantityAvailable + parsedAmount
		} else if (type === 'OUT' || type === 'SCRAP' || type === 'MOVE') {
			if (batch.quantityAvailable - parsedAmount < 0) {
				return NextResponse.json(
					{
						error:
							'Nie można wydać więcej opon niż dostępna ilość (ilość nie może być ujemna).',
					},
					{ status: 400 }
				)
			}
			newQuantityAvailable = batch.quantityAvailable - parsedAmount
		}

		// создаём запись о движении
		const movement = await prisma.tireMovement.create({
			data: {
				batchId: id,
				type,
				amount: parsedAmount,
				reason: reason || null,
			},
		})

		// обновляем остаток
		await prisma.tireBatch.update({
			where: { id },
			data: {
				quantityAvailable: newQuantityAvailable,
				// если что-то wydaliśmy / złomowaliśmy — помечаем, что фото можно освежить
				photoNeedsUpdate:
					type === 'OUT' || type === 'SCRAP' ? true : batch.photoNeedsUpdate,
			},
		})

		return NextResponse.json(movement, { status: 201 })
	} catch (error) {
		console.error('[POST /api/batches/:id/movements] error:', error)
		return NextResponse.json(
			{ error: 'Nie udało się zapisać ruchu magazynowego.' },
			{ status: 500 }
		)
	}
}
