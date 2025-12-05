'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function BatchesFilters() {
	const router = useRouter()
	const searchParams = useSearchParams()

	const [q, setQ] = useState(() => searchParams.get('q') || '')
	const [type, setType] = useState(() => searchParams.get('type') || '')
	const [season, setSeason] = useState(() => searchParams.get('season') || '')

	function applyFilters(newValues = {}) {
		const params = new URLSearchParams(searchParams.toString())

		const nextQ = newValues.q ?? q
		const nextType = newValues.type ?? type
		const nextSeason = newValues.season ?? season

		if (nextQ) params.set('q', nextQ)
		else params.delete('q')

		if (nextType) params.set('type', nextType)
		else params.delete('type')

		if (nextSeason) params.set('season', nextSeason)
		else params.delete('season')

		router.push(`/batches?${params.toString()}`)
	}

	// 🔎 debounced поиск по мере ввода
	useEffect(() => {
		const handle = setTimeout(() => {
			applyFilters({ q })
		}, 400) // 400ms — комфортно, можно подстроить

		return () => clearTimeout(handle)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [q])

	function handleSubmit(e) {
		e.preventDefault()
		applyFilters()
	}

	function resetFilters() {
		setQ('')
		setType('')
		setSeason('')
		router.push('/batches')
	}

	return (
		<form
			onSubmit={handleSubmit}
			className='border border-slate-800 rounded-xl bg-slate-900/40 p-3 md:p-4 mb-2 space-y-3'
		>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<h3 className='text-sm font-semibold text-slate-100'>
					Filtry i wyszukiwanie
				</h3>
				<button
					type='button'
					onClick={resetFilters}
					className='text-[11px] text-slate-400 hover:text-slate-100 underline underline-offset-4'
				>
					Wyczyść filtry
				</button>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-4 gap-3 text-xs md:text-sm'>
				<div className='space-y-1 md:col-span-2'>
					<label className='block text-slate-300'>Szukaj</label>
					<input
						value={q}
						onChange={e => setQ(e.target.value)}
						placeholder='marka, model, rozmiar (np. 205/55 R16, R17), lokalizacja...'
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					/>
					<p className='text-[10px] text-slate-500 mt-1'>
						Wyniki odświeżają się automatycznie podczas wpisywania.
					</p>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Typ partii</label>
					<select
						value={type}
						onChange={e => {
							setType(e.target.value)
							applyFilters({ type: e.target.value })
						}}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					>
						<option value=''>Wszystkie</option>
						<option value='STOCK'>Magazyn (sprzedaż)</option>
						<option value='STORAGE'>Przechowanie klienta</option>
					</select>
				</div>

				<div className='space-y-1'>
					<label className='block text-slate-300'>Sezon</label>
					<select
						value={season}
						onChange={e => {
							setSeason(e.target.value)
							applyFilters({ season: e.target.value })
						}}
						className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-50 text-xs'
					>
						<option value=''>Wszystkie</option>
						<option value='SUMMER'>Lato</option>
						<option value='WINTER'>Zima</option>
						<option value='ALL_SEASON'>Całoroczne</option>
					</select>
				</div>
			</div>

			{/* Кнопка submit остаётся как "принудительно обновить", но уже не обязательна */}
			<div className='flex justify-end'>
				<button
					type='submit'
					className='inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400'
				>
					Zastosuj filtry
				</button>
			</div>
		</form>
	)
}
