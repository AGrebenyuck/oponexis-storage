// lib/telegram/helpers/parsing.js

// парсим размер из строки: 205/55 R16, 205/55R16, 205.55, R17, 17", либо просто "205" как ширина
export function parseTireSize(input) {
	const textRaw = input.toUpperCase().replace(',', '.').trim()

	// 205.45 → 205/45
	let text = textRaw.replace(/(\d{3})\.(\d{2})/, '$1/$2')

	// 205/55 R16 или 205/55R16
	const reFull = /(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2})/
	const m1 = text.match(reFull)
	if (m1) {
		return {
			width: Number(m1[1]),
			height: Number(m1[2]),
			rimDiameter: Number(m1[3]),
		}
	}

	// отдельно 205/55
	const reWH = /(\d{3})\s*\/\s*(\d{2})/
	const mWH = text.match(reWH)

	// отдельно R16 или 16"
	const reRim = /R\s*(\d{2})|(\d{2})\s*("| CALI|CAL)/
	const mRim = text.match(reRim)

	let width = mWH ? Number(mWH[1]) : null
	let height = mWH ? Number(mWH[2]) : null
	let rimDiameter = mRim ? Number(mRim[1] || mRim[2]) : null

	// если вообще ничего не нашли и это просто "205" → считаем шириной
	if (!width && !height && !rimDiameter) {
		const mWidthOnly = text.match(/^\d{3}$/)
		if (mWidthOnly) {
			width = Number(mWidthOnly[0])
		}
	}

	return { width, height, rimDiameter }
}

// вырезаем из запроса размер/сезон, оставляем "человеческий" текст
export function buildTextQuery(input) {
	let t = input.toLowerCase()

	// убираем 205/55 или 205.55
	t = t.replace(/(\d{3})\s*[\/.]\s*(\d{2})/g, ' ')
	// убираем "чистую" ширину 205 (три цифры отдельно)
	t = t.replace(/\b\d{3}\b/g, ' ')
	// убираем R16, R 16, 16", 16 cal
	t = t.replace(/r\s*\d{2}/g, ' ')
	t = t.replace(/\b(\d{2})\s*(?:\"| cali|cal)\b/g, ' ')
	// убираем слова сезона
	t = t.replace(/\b(zima|zimowe|lato|letnie|całoroczne|all season)\b/gi, ' ')

	t = t.replace(/\s+/g, ' ').trim()
	return t || null
}

// определяем сезон по словам
export function detectSeason(input) {
	const t = input.toLowerCase()
	if (t.includes('zima') || t.includes('zimowe')) return 'WINTER'
	if (t.includes('lato') || t.includes('letnie')) return 'SUMMER'
	if (t.includes('całoroczne') || t.includes('all season')) return 'ALL_SEASON'
	return null
}
