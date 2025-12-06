// lib/telegram/helpers/formatting.js

export function buildSizeLabel(batch) {
	const parts = []
	if (batch.width && batch.height) {
		parts.push(`${batch.width}/${batch.height}`)
	}
	if (batch.rimDiameter) {
		parts.push(`R${batch.rimDiameter}`)
	}
	return parts.join(' ') || null
}

export function buildSeasonLabel(season) {
	if (!season) return 'Sezon: —'
	if (season === 'SUMMER') return 'Lato'
	if (season === 'WINTER') return 'Zima'
	if (season === 'ALL_SEASON') return 'Całoroczne'
	return season
}

export function buildBrandModel(batch) {
	return [batch.brand, batch.model].filter(Boolean).join(' ') || '—'
}

export function buildPriceLabel(batch) {
	if (batch.pricePerSet != null) {
		return `${batch.pricePerSet} zł za komplet`
	}
	if (batch.pricePerTire != null) {
		return `${batch.pricePerTire} zł za szt.`
	}
	return '—'
}

export function buildSummaryDescription(parsedSize, season) {
	if (!parsedSize && !season) return 'Filtr: magazyn (sprzedaż)'

	const parts = []
	if (
		parsedSize &&
		parsedSize.width &&
		parsedSize.height &&
		parsedSize.rimDiameter
	) {
		parts.push(
			`${parsedSize.width}/${parsedSize.height} R${parsedSize.rimDiameter}`
		)
	} else if (parsedSize && parsedSize.rimDiameter) {
		parts.push(`R${parsedSize.rimDiameter}`)
	} else if (parsedSize && parsedSize.width) {
		parts.push(`${parsedSize.width}`)
	}
	if (season === 'WINTER') parts.push('zima')
	if (season === 'SUMMER') parts.push('lato')
	if (season === 'ALL_SEASON') parts.push('całoroczne')

	if (!parts.length) return 'Filtr: magazyn (sprzedaż)'
	return parts.join(', ') + ' · magazyn (sprzedaż)'
}
