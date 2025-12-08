// app/(admin)/batches/[id]/MovementForm.jsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import message from '../../../../components/message'

export default function MovementForm({ batchId, quantityAvailable }) {
	const [type, setType] = useState('OUT')
	const [amount, setAmount] = useState('')
	const [reason, setReason] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	const router = useRouter()

	async function handleSubmit(e) {
		e.preventDefault()
		setIsSubmitting(true)

		const close = message.loading('Zapisywanie ruchu...', {
			position: 'topRight',
		})

		try {
			const res = await fetch(`/api/batches/${batchId}/movements`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, amount, reason }),
			})

			let data = null
			try {
				data = await res.json()
			} catch {}

			if (!res.ok) {
				throw new Error(data?.error || 'Błąd zapisu ruchu magazynowego')
			}

			setAmount('')
			setReason('')
			close()
			message.success('Ruch magazynowy zapisany ✅', 2, {
				position: 'topRight',
			})
			router.refresh()
		} catch (err) {
			console.error('Movement error:', err)
			close()
			message.error(err.message || 'Błąd zapisu ruchu magazynowego', 3, {
				position: 'topRight',
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	const isOutLike = type === 'OUT' || type === 'SCRAP'

	return (
		<form
			onSubmit={handleSubmit}
			className='border border-slate-800 rounded-xl bg-slate-900/40 p-3 space-y-3 text-xs md:text-sm'
		>
			<div className='flex items-center justify-between gap-2'>
				<h3 className='font-semibold text-slate-100'>Ruch magazynowy</h3>
				<span className='text-[10px] text-slate-500'>
					np. wydanie, przyjęcie, złomowanie
				</span>
			</div>

			<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
				<div className='space-y-1'>
					<label className='block text-slate-300'>Typ ruchu</label>
					<select
						value={type}
						onChange={e => setType(e.target.value)}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					>
						<option value='OUT'>Wydanie (OUT)</option>
						<option value='IN'>Przyjęcie (IN)</option>
						<option value='SCRAP'>Złomowanie (SCRAP)</option>
						<option value='MOVE'>Przeniesienie (MOVE)</option>
					</select>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>
						Ilość
						{typeof quantityAvailable === 'number' && (
							<span className='ml-1 text-[10px] text-slate-400'>
								(dostępne: {quantityAvailable})
							</span>
						)}
					</label>
					<input
						type='number'
						min={1}
						value={amount}
						onChange={e => setAmount(e.target.value)}
						required={type !== 'MOVE'} // для MOVE можно будет не указывать
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='np. 2'
					/>
					{isOutLike && typeof quantityAvailable === 'number' && (
						<p className='text-[10px] text-slate-500 mt-1'>
							Maksymalnie możesz zdjąć: {quantityAvailable} szt.
						</p>
					)}
				</div>

				<div className='space-y-1 sm:col-span-1'>
					<label className='block text-slate-300'>Powód / opis</label>
					<input
						value={reason}
						onChange={e => setReason(e.target.value)}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='np. sprzedaż klientowi'
					/>
				</div>
			</div>

			<div className='flex items-center gap-3 pt-1'>
				<button
					type='submit'
					disabled={isSubmitting}
					className='inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed'
				>
					{isSubmitting ? 'Zapisuję...' : 'Zapisz ruch'}
				</button>
			</div>
		</form>
	)
}
