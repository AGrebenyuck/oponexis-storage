// app/(admin)/batches/page.jsx
import { prisma } from '../../../lib/prisma'
import BatchesFilters from './BatchesFilters'
import BatchRowActions from './BatchRowActions'
import CreateBatchPanel from './CreateBatchPanel'

/* ========= helpers для парсинга строки поиска ========= */

function detectSeasonFromQuery(raw = '') {
	const q = raw.toLowerCase()

	if (/(lato|summer|лето)/.test(q)) return 'SUMMER'
	if (/(zima|winter|зима)/.test(q)) return 'WINTER'
	if (
		/(całoroczne|caloroczne|all\s*season|4sezon|4 sezon|4season|4 seasons)/.test(
			q
		)
	)
		return 'ALL_SEASON'

	return null
}

function detectYearFromQuery(raw = '') {
	const m = raw.match(/\b(19|20)\d{2}\b/)
	if (!m) return null
	const year = parseInt(m[0], 10)
	if (Number.isNaN(year)) return null
	return year
}

function parseTireSizeFromQuery(raw = '') {
	const q = raw.toLowerCase().replace(',', '.')
	const result = {
		width: null,
		height: null,
		rimDiameter: null,
	}

	// 205/55, 205-55, 205.55
	const sizeMatch = q.match(/(\d{3})\s*[\/\\.,-]\s*(\d{2})/)
	if (sizeMatch) {
		result.width = parseInt(sizeMatch[1], 10)
		result.height = parseInt(sizeMatch[2], 10)
	}

	// r17 / R17 / р17
	const rimMatch = q.match(/[rр]\s*(\d{2})/)
	if (rimMatch) {
		result.rimDiameter = parseInt(rimMatch[1], 10)
	}

	// если нет width, берём первое трёхзначное (100–400)
	if (!result.width) {
		const widthMatch = q.match(/\b([1-3]\d{2}|400)\b/)
		if (widthMatch) {
			const w = parseInt(widthMatch[1], 10)
			if (!Number.isNaN(w)) {
				result.width = w
			}
		}
	}

	return result
}

/**
 * Оставляем только "словесную" часть: бренд, модель, заметки, локация.
 */
function buildTextQuery(raw = '') {
	const seasonWords = new Set([
		'lato',
		'summer',
		'лето',
		'zima',
		'winter',
		'зима',
		'całoroczne',
		'caloroczne',
		'all',
		'season',
		'sezon',
		'4sezon',
		'4season',
	])

	const tokens = raw
		.toLowerCase()
		.split(/\s+/)
		.map(t => t.trim())
		.filter(Boolean)

	const textTokens = tokens.filter(t => {
		if (seasonWords.has(t)) return false
		if (/^\d+$/.test(t)) return false
		if (/^\d{3}[\/\\.,-]\d{2}$/.test(t)) return false
		if (/^[rр]\d{2}$/.test(t)) return false
		if (/^(19|20)\d{2}$/.test(t)) return false
		return true
	})

	const text = textTokens.join(' ').trim()
	return text || null
}

/* ========= helper для подсветки ========= */

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

/* ========= основной запрос в БД ========= */

async function getBatches(filters) {
	const { type, season: seasonFilter, q } = filters || {}

	const baseWhere = {}
	if (type) baseWhere.type = type
	if (seasonFilter) baseWhere.season = seasonFilter

	// если нет поисковой строки — только фильтры type/season из селектов
	if (!q || !q.trim()) {
		return prisma.tireBatch.findMany({
			where: baseWhere,
			include: {
				photos: {
					where: { isMain: true },
					take: 1,
				},
			},
			orderBy: { createdAt: 'desc' },
		})
	}

	const trimmed = q.trim()

	const parsedSize = parseTireSizeFromQuery(trimmed)
	const parsedSeason = detectSeasonFromQuery(trimmed)
	const parsedYear = detectYearFromQuery(trimmed)
	const textQuery = buildTextQuery(trimmed)

	const where = { ...baseWhere }

	// Сезон из строки, если не выбран в селекте
	if (!seasonFilter && parsedSeason) {
		where.season = parsedSeason
	}

	if (parsedSize.rimDiameter) where.rimDiameter = parsedSize.rimDiameter
	if (parsedSize.width) where.width = parsedSize.width
	if (parsedSize.height) where.height = parsedSize.height

	if (parsedYear) where.productionYear = parsedYear

	if (textQuery) {
		where.OR = [
			{ brand: { contains: textQuery, mode: 'insensitive' } },
			{ model: { contains: textQuery, mode: 'insensitive' } },
			{ notes: { contains: textQuery, mode: 'insensitive' } },
			{ locationCode: { contains: textQuery, mode: 'insensitive' } },
		]
	}

	const finalWhere = Object.keys(where).length === 0 ? baseWhere : where

	return prisma.tireBatch.findMany({
		where: finalWhere,
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
}

/* ========= сам компонент страницы ========= */

export default async function BatchesPage({ searchParams }) {
	const sp = await searchParams

	const filters = {
		type: sp?.type || '',
		season: sp?.season || '',
		q: sp?.q || '',
	}

	const batches = await getBatches(filters)
	const hasFilters = !!filters.q || !!filters.type || !!filters.season

	// токены для подсветки
	const parsedSize = parseTireSizeFromQuery(filters.q || '')
	const parsedYear = detectYearFromQuery(filters.q || '')
	const textQuery = buildTextQuery(filters.q || '')

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

								// токен для подсветки размера
								let sizeHighlightToken = ''
								if (parsedSize.width && parsedSize.height) {
									sizeHighlightToken = `${parsedSize.width}/${parsedSize.height}`
								} else if (parsedSize.rimDiameter) {
									sizeHighlightToken = String(parsedSize.rimDiameter)
								} else if (filters.q) {
									sizeHighlightToken = filters.q
								}

								// токен для подсветки года
								const yearHighlightToken = parsedYear
									? String(parsedYear)
									: filters.q

								// токен для бренда/модели — текстовая часть
								const brandHighlightToken = textQuery || filters.q

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
											{highlightMatch(sizeLabel || '—', sizeHighlightToken)}
										</td>
										<td className='px-3 py-2 align-middle text-xs text-slate-300'>
											{seasonLabel}
										</td>
										<td className='px-3 py-2 align-middle text-xs text-slate-300'>
											{highlightMatch(yearLabel, yearHighlightToken)}
										</td>
										<td className='px-3 py-2 align-middle text-sm text-slate-200'>
											{highlightMatch(brandModelLabel, brandHighlightToken)}
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
											{highlightMatch(
												batch.locationCode || '—',
												brandHighlightToken
											)}
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
