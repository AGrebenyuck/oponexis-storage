// app/(admin)/batches/[id]/BatchEditForm.jsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function BatchEditForm({ batch }) {
	const router = useRouter()
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [success, setSuccess] = useState(false)

	const [form, setForm] = useState({
		type: batch.type || 'STOCK',
		season: batch.season || '',
		brand: batch.brand || '',
		model: batch.model || '',
		productionYear: batch.productionYear ? String(batch.productionYear) : '',
		pricePerSet: batch.pricePerSet != null ? String(batch.pricePerSet) : '',
		pricePerTire: batch.pricePerTire != null ? String(batch.pricePerTire) : '',
		locationCode: batch.locationCode || '',
		storageOwnerName: batch.storageOwnerName || '',
		storageOwnerPhone: batch.storageOwnerPhone || '',
		notes: batch.notes || '',
	})

	function updateField(field, value) {
		setForm(prev => ({ ...prev, [field]: value }))
		setSuccess(false)
		setError(null)
	}

	async function handleSubmit(e) {
		e.preventDefault()
		setLoading(true)
		setError(null)
		setSuccess(false)

		try {
			const res = await fetch(`/api/batches/${batch.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(form),
			})

			let data = null
			try {
				data = await res.json()
			} catch (e) {
				// если пришёл не-JSON — просто логируем
				console.warn('PATCH /api/batches response is not JSON')
			}

			if (!res.ok || !data?.ok) {
				const msg = data?.error || `Błąd podczas zapisu (status ${res.status})`

				console.log(res)

				throw new Error(msg)
			}

			setSuccess(true)
			// подтягиваем свежие данные сервера
			router.refresh()
		} catch (err) {
			console.error('[BatchEditForm] submit error:', err)
			setError(err.message || 'Błąd podczas zapisu zmian')
		} finally {
			setLoading(false)
		}
	}

	const isStorage = form.type === 'STORAGE'

	return (
		<form
			onSubmit={handleSubmit}
			className='border border-slate-800 rounded-xl bg-slate-900/40 p-4 space-y-3 text-sm'
		>
			<div className='flex items-center justify-between gap-3'>
				<h3 className='text-sm font-semibold text-slate-100'>
					Dane partii (edycja)
				</h3>
				{success && (
					<span className='text-xs text-emerald-400'>✔ Zapisano zmiany</span>
				)}
				{error && <span className='text-xs text-red-400'>{error}</span>}
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
				{/* Typ */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>Typ</label>
					<select
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.type}
						onChange={e => updateField('type', e.target.value)}
					>
						<option value='STOCK'>Magazyn (sprzedaż)</option>
						<option value='STORAGE'>Przechowanie klienta</option>
					</select>
				</div>

				{/* Sezon */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>Sezon</label>
					<select
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.season}
						onChange={e => updateField('season', e.target.value)}
					>
						<option value=''>—</option>
						<option value='SUMMER'>Lato</option>
						<option value='WINTER'>Zima</option>
						<option value='ALL_SEASON'>Całoroczne</option>
					</select>
				</div>

				{/* Marka */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>Marka</label>
					<input
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.brand}
						onChange={e => updateField('brand', e.target.value)}
					/>
				</div>

				{/* Model */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>Model</label>
					<input
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.model}
						onChange={e => updateField('model', e.target.value)}
					/>
				</div>

				{/* Rok produkcji */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>Rok produkcji</label>
					<input
						type='number'
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.productionYear}
						onChange={e => updateField('productionYear', e.target.value)}
						min='1990'
						max='2050'
					/>
				</div>

				{/* Cena za komplet */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>
						Cena za komplet (zł)
					</label>
					<input
						type='number'
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.pricePerSet}
						onChange={e => updateField('pricePerSet', e.target.value)}
						min='0'
					/>
				</div>

				{/* Cena za sztukę */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>
						Cena za sztukę (zł)
					</label>
					<input
						type='number'
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.pricePerTire}
						onChange={e => updateField('pricePerTire', e.target.value)}
						min='0'
					/>
				</div>

				{/* Lokalizacja */}
				<div className='space-y-1'>
					<label className='block text-xs text-slate-400'>
						Lokalizacja na magazynie
					</label>
					<input
						className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
						value={form.locationCode}
						onChange={e => updateField('locationCode', e.target.value)}
						placeholder='np. A-3-2'
					/>
				</div>

				{/* Dane właściciela – только для STORAGE */}
				{isStorage && (
					<>
						<div className='space-y-1'>
							<label className='block text-xs text-slate-400'>
								Właściciel – imię / nazwa
							</label>
							<input
								className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
								value={form.storageOwnerName}
								onChange={e => updateField('storageOwnerName', e.target.value)}
							/>
						</div>
						<div className='space-y-1'>
							<label className='block text-xs text-slate-400'>
								Właściciel – telefon
							</label>
							<input
								className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
								value={form.storageOwnerPhone}
								onChange={e => updateField('storageOwnerPhone', e.target.value)}
							/>
						</div>
					</>
				)}
			</div>

			{/* Notatki */}
			<div className='space-y-1'>
				<label className='block text-xs text-slate-400'>Notatki</label>
				<textarea
					rows={3}
					className='w-full rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100'
					value={form.notes}
					onChange={e => updateField('notes', e.target.value)}
					placeholder='Dowolne dodatkowe informacje o partii'
				/>
			</div>

			<div className='flex items-center justify-between gap-3 pt-2'>
				<button
					type='submit'
					disabled={loading}
					className='inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed'
				>
					{loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
				</button>

				<span className='text-[11px] text-slate-500'>
					Zmiany dotyczą tylko danych partii, ilość & ruchy edytujesz w sekcji
					poniżej.
				</span>
			</div>
		</form>
	)
}
