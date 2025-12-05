import { prisma } from '../../../lib/prisma'
import BatchesFilters from './BatchesFilters'
import BatchRowActions from './BatchRowActions'
import CreateBatchPanel from './CreateBatchPanel'

// helper для подсветки совпадений w tekście
function highlightMatch(text, query) {
	if (!query) return text
	if (!text) return '—'

	const lowerText = text.toLowerCase()
	const lowerQuery = query.toLowerCase()

	const index = lowerText.indexOf(lowerQuery)
	if (index === -1) return text

	const before = text.slice(0, index)
	const match = text.slice(index, index + query.length)
	const after = text.slice(index + query.length)

	return (
		<>
			{before}
			<span className='bg-amber-500/30 text-amber-50 px-0.5 rounded'>
				{match}
			</span>
			{after}
		</>
	)
}

async function getBatches(filters) {
	const { type, season, q } = filters || {}
	const where = {}

	if (type) where.type = type
	if (season) where.season = season

	if (q) {
		const trimmed = q.trim()
		const numeric = parseInt(trimmed, 10)

		where.OR = [
			{ brand: { contains: trimmed, mode: 'insensitive' } },
			{ model: { contains: trimmed, mode: 'insensitive' } },
			{ notes: { contains: trimmed, mode: 'insensitive' } },
			{ locationCode: { contains: trimmed, mode: 'insensitive' } },
		]

		if (!Number.isNaN(numeric)) {
			where.OR.push(
				{ rimDiameter: numeric },
				{ width: numeric },
				{ height: numeric },
				// 🆕 szukamy też po roku produkcji
				{ productionYear: numeric }
			)
		}
	}

	const batches = await prisma.tireBatch.findMany({
		where,
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

	return batches
}

export default async function BatchesPage({ searchParams }) {
	const sp = await searchParams

	const filters = {
		type: sp?.type || '',
		season: sp?.season || '',
		q: sp?.q || '',
	}

	const batches = await getBatches(filters)
	const hasFilters = !!filters.q || !!filters.type || !!filters.season

	return (
		<div className='space-y-4'>
			<CreateBatchPanel />
			<BatchesFilters />

			<div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
				<div>
					<h2 className='text-xl font-semibold tracking-tight'>Partie opon</h2>
					<p className='text-sm text-slate-400'>
						Ewidencja opon na magazynie i w przechowaniu. Możesz filtrować po
						typie, sezonie i szukać po rozmiarze, marce, modelu, roku lub
						lokalizacji.
					</p>
				</div>

				<div className='flex flex-col items-start md:items-end gap-1 text-xs'>
					<span className='text-slate-400'>
						Znaleziono{' '}
						<span className='font-semibold text-slate-100'>
							{batches.length}
						</span>{' '}
						{batches.length === 1 ? 'partię' : 'partii'}
					</span>

					{hasFilters && (
						<div className='flex flex-wrap gap-1'>
							{filters.q && (
								<span className='inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-100 border border-slate-600'>
									Szukaj: <span className='ml-1 font-medium'>{filters.q}</span>
								</span>
							)}
							{filters.type && (
								<span className='inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-100 border border-slate-600'>
									Typ:{' '}
									<span className='ml-1 font-medium'>
										{filters.type === 'STOCK'
											? 'Magazyn (sprzedaż)'
											: 'Przechowanie klienta'}
									</span>
								</span>
							)}
							{filters.season && (
								<span className='inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-100 border border-slate-600'>
									Sezon:{' '}
									<span className='ml-1 font-medium'>
										{filters.season === 'SUMMER'
											? 'Lato'
											: filters.season === 'WINTER'
											? 'Zima'
											: 'Całoroczne'}
									</span>
								</span>
							)}
						</div>
					)}
				</div>
			</div>

			{batches.length === 0 ? (
				<div className='border border-dashed border-slate-700 rounded-xl p-6 text-sm text-slate-400'>
					Brak partii spełniających podane kryteria.
				</div>
			) : (
				<div className='overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40'>
					<table className='min-w-full text-sm'>
						<thead className='border-b border-slate-800 bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400'>
							<tr>
								<th className='px-3 py-2 text-left'>Zdjęcie</th>
								<th className='px-3 py-2 text-left'>Typ</th>
								<th className='px-3 py-2 text-left'>Rozmiar</th>
								<th className='px-3 py-2 text-left'>Sezon</th>
								{/* 🆕 Rok produkcji */}
								<th className='px-3 py-2 text-left'>Rok</th>
								<th className='px-3 py-2 text-left'>Marka / model</th>
								<th className='px-3 py-2 text-left'>Ilość</th>
								<th className='px-3 py-2 text-left'>Cena</th>
								<th className='px-3 py-2 text-left'>Właściciel</th>
								<th className='px-3 py-2 text-left'>Lokalizacja</th>
								<th className='px-3 py-2 text-left'>Status zdjęć</th>
								<th className='px-3 py-2 text-left'>Akcje</th>
							</tr>
						</thead>
						<tbody>
							{batches.map(batch => {
								const mainPhoto = batch.photos[0]
								const sizeLabel = [
									`R${batch.rimDiameter}`,
									batch.width && batch.height
										? `${batch.width}/${batch.height}`
										: null,
								]
									.filter(Boolean)
									.join(' ')

								const seasonLabel =
									batch.season === 'SUMMER'
										? 'Lato'
										: batch.season === 'WINTER'
										? 'Zima'
										: batch.season === 'ALL_SEASON'
										? 'Całoroczne'
										: '—'

								const typeLabel =
									batch.type === 'STOCK'
										? 'Magazyn (sprzedaż)'
										: 'Przechowanie klienta'

								const qtyLabel = `${batch.quantityAvailable} / ${batch.quantityTotal}`

								const priceLabel =
									batch.pricePerSet != null
										? `${batch.pricePerSet} za komplet`
										: batch.pricePerTire != null
										? `${batch.pricePerTire} za szt.`
										: '—'

								const ownerLabel =
									batch.type === 'STORAGE'
										? [batch.storageOwnerName, batch.storageOwnerPhone]
												.filter(Boolean)
												.join(', ')
										: '—'

								const brandModelLabel =
									[batch.brand, batch.model].filter(Boolean).join(' ') || '—'

								const yearLabel = batch.productionYear
									? String(batch.productionYear)
									: '—'

								return (
									<tr
										key={batch.id}
										className='border-b border-slate-800/60 hover:bg-slate-900/70'
									>
										<td className='px-3 py-2 align-middle'>
											{mainPhoto ? (
												<a
													href={`/batches/${batch.id}`}
													className='inline-block'
												>
													<img
														src={mainPhoto.url}
														alt={sizeLabel || 'Partia opon'}
														className='h-12 w-12 rounded-lg object-cover border border-slate-700 hover:border-emerald-400/60 transition-colors'
													/>
												</a>
											) : (
												<div className='h-12 w-12 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500'>
													brak zdjęcia
												</div>
											)}
										</td>
										<td className='px-3 py-2 align-middle text-xs text-slate-300'>
											{typeLabel}
										</td>
										<td className='px-3 py-2 align-middle text-sm font-medium text-slate-50'>
											{highlightMatch(sizeLabel || '—', filters.q)}
										</td>
										<td className='px-3 py-2 align-middle text-xs text-slate-300'>
											{seasonLabel}
										</td>
										{/* 🆕 Rok w tabeli */}
										<td className='px-3 py-2 align-middle text-xs text-slate-300'>
											{highlightMatch(yearLabel, filters.q)}
										</td>
										<td className='px-3 py-2 align-middle text-sm text-slate-200'>
											{highlightMatch(brandModelLabel, filters.q)}
										</td>
										<td className='px-3 py-2 align-middle text-sm text-slate-200'>
											{qtyLabel}
										</td>
										<td className='px-3 py-2 align-middle text-sm text-slate-200'>
											{priceLabel}
										</td>
										<td className='px-3 py-2 align-middle text-xs text-slate-300'>
											{ownerLabel}
										</td>
										<td className='px-3 py-2 align-middle text-xs text-slate-300'>
											{highlightMatch(batch.locationCode || '—', filters.q)}
										</td>
										<td className='px-3 py-2 align-middle text-xs'>
											{batch.photoNeedsUpdate ? (
												<span className='inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30'>
													wymagana aktualizacja zdjęć
												</span>
											) : (
												<span className='inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30'>
													zdjęcia aktualne
												</span>
											)}
										</td>
										<td className='px-3 py-2 align-middle text-xs'>
											<BatchRowActions batchId={batch.id} />
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
