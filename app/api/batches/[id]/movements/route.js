// app/api/batches/[id]/movements/route.js
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma' // тот же путь, что и в /api/batches/[id]/route.js

export async function POST(request, ctx) {
	try {
		const { id } = await ctx.params

		if (!id) {
			return NextResponse.json({ error: 'Brak ID partii' }, { status: 400 })
		}

		const body = await request.json().catch(() => ({}))
		const { type, amount, reason, newLocation } = body || {}

		if (!type) {
			return NextResponse.json(
				{ error: 'Typ ruchu jest wymagany' },
				{ status: 400 }
			)
		}

		const rawAmount = parseInt(amount, 10)
		if (
			(type === 'IN' || type === 'OUT' || type === 'SCRAP') &&
			(!rawAmount || rawAmount <= 0)
		) {
			return NextResponse.json(
				{ error: 'Ilość musi być dodatnią liczbą' },
				{ status: 400 }
			)
		}

		const batch = await prisma.tireBatch.findUnique({
			where: { id },
		})

		if (!batch) {
			return NextResponse.json(
				{ error: 'Partia nie istnieje' },
				{ status: 404 }
			)
		}

		// ===== логика изменения количества =====
		let delta = 0

		if (type === 'IN') {
			delta = rawAmount // +N
		} else if (type === 'OUT' || type === 'SCRAP') {
			delta = -rawAmount // -N
		}

		const newAvailable =
			delta !== 0
				? (batch.quantityAvailable ?? 0) + delta
				: batch.quantityAvailable ?? 0

		if (delta !== 0 && newAvailable < 0) {
			return NextResponse.json(
				{
					error: `Za mało opon na magazynie. Dostępne: ${batch.quantityAvailable}, próbujesz zdjąć: ${rawAmount}`,
				},
				{ status: 400 }
			)
		}

		const willDeleteBatch =
			delta < 0 && newAvailable === 0 && (type === 'OUT' || type === 'SCRAP')

		await prisma.$transaction(async tx => {
			// 1) записываем movement (для MOVE amount можно хранить как 0 или введённое значение)
			await tx.tireMovement.create({
				data: {
					batchId: id,
					type,
					amount: delta !== 0 ? delta : rawAmount || 0,
					reason: reason || null,
				},
			})

			// 2) логика по типам
			if (type === 'MOVE') {
				// переносим партию на другую локацию (если прислали newLocation)
				if (newLocation && typeof newLocation === 'string') {
					await tx.tireBatch.update({
						where: { id },
						data: {
							locationCode: newLocation,
							// количество не меняется, фотки считаем актуальными
						},
					})
				}
				return
			}

			if (delta !== 0) {
				// если всё выдали/заскрапили — удаляем партию
				if (willDeleteBatch) {
					await tx.tireBatch.delete({
						where: { id },
					})
					return
				}

				// иначе просто обновляем количество и помечаем, что фото устарели
				await tx.tireBatch.update({
					where: { id },
					data: {
						quantityAvailable: newAvailable,
						photoNeedsUpdate: true, // 🔥 важный флаг
					},
				})
			}
		})

		return NextResponse.json({
			ok: true,
			deleted: willDeleteBatch,
			newAvailable,
		})
	} catch (err) {
		console.error('[POST /api/batches/[id]/movements] error:', err)
		return NextResponse.json(
			{ error: 'Błąd serwera podczas zapisu ruchu' },
			{ status: 500 }
		)
	}
}
