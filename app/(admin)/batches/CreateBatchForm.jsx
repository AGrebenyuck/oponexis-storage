'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const initialState = {
	type: 'STOCK',
	rimDiameter: '',
	width: '',
	height: '',
	season: '',
	brand: '',
	model: '',
	condition: '',
	// 🆕 rok produkcji
	productionYear: '',
	quantityTotal: '',
	quantityAvailable: '',
	pricePerTire: '',
	pricePerSet: '',
	storageOwnerName: '',
	storageOwnerPhone: '',
	storageStartedAt: '',
	storageExpiresAt: '',
	locationCode: '',
	notes: '',
}

export default function CreateBatchForm() {
	const [form, setForm] = useState(initialState)
	const [files, setFiles] = useState([])
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState(null)
	const router = useRouter()

	function handleChange(e) {
		const { name, value } = e.target
		setForm(prev => ({ ...prev, [name]: value }))
	}

	function handleFilesChange(e) {
		const list = e.target.files
		if (!list) {
			setFiles([])
			return
		}
		setFiles(Array.from(list))
	}

	async function handleSubmit(e) {
		e.preventDefault()
		setError(null)
		setIsSubmitting(true)

		try {
			const payload = { ...form }

			// jeśli ilość dostępna pusta – ustaw = całkowita
			if (!payload.quantityAvailable && payload.quantityTotal) {
				payload.quantityAvailable = payload.quantityTotal
			}

			// jeśli rok pusty – отправляем null, обработка на API
			if (!payload.productionYear) {
				delete payload.productionYear
			}

			const res = await fetch('/api/batches', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Nie udało się utworzyć partii')
			}

			const batch = await res.json()

			// jeśli są pliki — ładujemy po kolei
			if (files.length > 0 && batch?.id) {
				for (const file of files) {
					const fd = new FormData()
					fd.append('file', file)

					const uploadRes = await fetch(`/api/batches/${batch.id}/photos`, {
						method: 'POST',
						body: fd,
					})

					if (!uploadRes.ok) {
						console.error('Upload photo failed for file:', file.name)
					}
				}
			}

			setForm(initialState)
			setFiles([])
			router.refresh()
		} catch (err) {
			console.error('Create batch error:', err)
			setError(err.message)
		} finally {
			setIsSubmitting(false)
		}
	}

	const isStorage = form.type === 'STORAGE'

	return (
		<div className='border border-slate-800 rounded-xl bg-slate-900/40 p-4 md:p-5 space-y-4'>
			<div className='flex items-center justify-between gap-2'>
				<div>
					<h3 className='text-sm font-semibold text-slate-100'>
						Dodaj partię opon
					</h3>
					<p className='text-xs text-slate-400'>
						Minimalne dane: typ, rozmiar (R) i ilość.
					</p>
				</div>
			</div>

			<form
				onSubmit={handleSubmit}
				className='grid grid-cols-1 md:grid-cols-4 gap-3 text-xs md:text-sm'
			>
				<div className='space-y-1'>
					<label className='block text-slate-300'>Typ</label>
					<select
						name='type'
						value={form.type}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					>
						<option value='STOCK'>Magazyn (sprzedaż)</option>
						<option value='STORAGE'>Przechowanie klienta</option>
					</select>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Średnica felgi (R)</label>
					<input
						name='rimDiameter'
						type='number'
						value={form.rimDiameter}
						onChange={handleChange}
						required
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='17'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Szerokość</label>
					<input
						name='width'
						type='number'
						value={form.width}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='205'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Profil</label>
					<input
						name='height'
						type='number'
						value={form.height}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='55'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Sezon</label>
					<select
						name='season'
						value={form.season}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					>
						<option value=''>—</option>
						<option value='SUMMER'>Lato</option>
						<option value='WINTER'>Zima</option>
						<option value='ALL_SEASON'>Całoroczne</option>
					</select>
				</div>

				{/* 🆕 Rok produkcji */}
				<div className='space-y-1'>
					<label className='block text-slate-300'>
						Rok produkcji <span className='text-slate-500'>(opcjonalnie)</span>
					</label>
					<input
						name='productionYear'
						type='number'
						min='1990'
						max='2050'
						value={form.productionYear}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='np. 2019'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Marka</label>
					<input
						name='brand'
						value={form.brand}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='Michelin'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Model</label>
					<input
						name='model'
						value={form.model}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='Pilot Sport 4'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Stan</label>
					<input
						name='condition'
						value={form.condition}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='5 mm bieżnika, bez wybrzuszeń'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Ilość całkowita</label>
					<input
						name='quantityTotal'
						type='number'
						value={form.quantityTotal}
						onChange={handleChange}
						required
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='4'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Ilość dostępna</label>
					<input
						name='quantityAvailable'
						type='number'
						value={form.quantityAvailable}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='domyślnie = ilość całkowita'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Cena za sztukę</label>
					<input
						name='pricePerTire'
						type='number'
						value={form.pricePerTire}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					/>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Cena za komplet</label>
					<input
						name='pricePerSet'
						type='number'
						value={form.pricePerSet}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					/>
				</div>

				{isStorage && (
					<>
						<div className='space-y-1'>
							<label className='block text-slate-300'>Imię klienta</label>
							<input
								name='storageOwnerName'
								value={form.storageOwnerName}
								onChange={handleChange}
								className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
								placeholder='Jan Kowalski'
							/>
						</div>

						<div className='space-y-1'>
							<label className='block text-slate-300'>Telefon klienta</label>
							<input
								name='storageOwnerPhone'
								value={form.storageOwnerPhone}
								onChange={handleChange}
								className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
								placeholder='+48...'
							/>
						</div>

						<div className='space-y-1'>
							<label className='block text-slate-300'>
								Początek przechowania
							</label>
							<input
								name='storageStartedAt'
								type='date'
								value={form.storageStartedAt}
								onChange={handleChange}
								className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
							/>
						</div>

						<div className='space-y-1'>
							<label className='block text-slate-300'>
								Koniec przechowania
							</label>
							<input
								name='storageExpiresAt'
								type='date'
								value={form.storageExpiresAt}
								onChange={handleChange}
								className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
							/>
						</div>
					</>
				)}

				<div className='space-y-1'>
					<label className='block text-slate-300'>
						Lokalizacja na magazynie
					</label>
					<input
						name='locationCode'
						value={form.locationCode}
						onChange={handleChange}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
						placeholder='A-3-2'
					/>
				</div>

				<div className='space-y-1 md:col-span-2'>
					<label className='block text-slate-300'>Notatki</label>
					<textarea
						name='notes'
						value={form.notes}
						onChange={handleChange}
						rows={2}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs resize-none'
						placeholder='Dodatkowe informacje o partii...'
					/>
				</div>

				<div className='space-y-1 md:col-span-2'>
					<label className='block text-slate-300'>Zdjęcia (opcjonalnie)</label>
					<input
						type='file'
						multiple
						accept='image/*'
						onChange={handleFilesChange}
						className='w-full text-[11px] text-slate-200 file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-[11px] file:text-slate-100 hover:file:bg-slate-700'
					/>
					{files.length > 0 && (
						<p className='text-[10px] text-slate-400'>
							Wybrane pliki: {files.map(f => f.name).join(', ')}
						</p>
					)}
				</div>

				<div className='md:col-span-4 flex items-center gap-3 pt-1'>
					<button
						type='submit'
						disabled={isSubmitting}
						className='inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed'
					>
						{isSubmitting ? 'Zapisuję...' : 'Zapisz partię'}
					</button>
					{error && <p className='text-xs text-red-400'>{error}</p>}
				</div>
			</form>
		</div>
	)
}
