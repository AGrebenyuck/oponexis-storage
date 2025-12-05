import { prisma } from '../../../../lib/prisma'
import UploadPhotoButton from '../UploadPhotoButton'
import MovementForm from './MovementForm'
import PhotoActions from './PhotoActions'

async function getBatch(id) {
	const batch = await prisma.tireBatch.findUnique({
		where: { id },
		include: {
			photos: {
				orderBy: { createdAt: 'desc' },
			},
			movements: {
				orderBy: { createdAt: 'desc' },
				take: 20,
			},
		},
	})

	return batch
}

export default async function BatchDetailsPage({ params }) {
	const { id } = await params
	const batch = await getBatch(id)

	if (!batch) {
		return (
			<div className='space-y-4'>
				<h2 className='text-xl font-semibold tracking-tight'>Partia opon</h2>
				<p className='text-sm text-slate-400'>
					Partia o podanym identyfikatorze nie została znaleziona.
				</p>
			</div>
		)
	}

	const sizeLabel = [
		`R${batch.rimDiameter}`,
		batch.width && batch.height ? `${batch.width}/${batch.height}` : null,
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
		batch.type === 'STOCK' ? 'Magazyn (sprzedaż)' : 'Przechowanie klienta'

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

	const yearLabel = batch.productionYear ? batch.productionYear : '—'

	return (
		<div className='space-y-6'>
			<div className='flex items-center justify-between gap-3'>
				<div>
					<h2 className='text-xl font-semibold tracking-tight'>
						Szczegóły partii
					</h2>
					<p className='text-sm text-slate-400'>
						Zarządzanie zdjęciami i podstawowymi informacjami o partii.
					</p>
				</div>
				<a
					href='/batches'
					className='text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4'
				>
					← wróć do listy
				</a>
			</div>

			{/* Dane o partii */}
			<div className='border border-slate-800 rounded-xl bg-slate-900/40 p-4 space-y-2 text-sm'>
				<div className='flex flex-wrap gap-x-6 gap-y-1'>
					<div>
						<span className='text-slate-400'>Typ: </span>
						<span className='text-slate-100'>{typeLabel}</span>
					</div>
					<div>
						<span className='text-slate-400'>Rozmiar: </span>
						<span className='text-slate-100'>{sizeLabel || '—'}</span>
					</div>
					<div>
						<span className='text-slate-400'>Sezon: </span>
						<span className='text-slate-100'>{seasonLabel}</span>
					</div>
					{/* 🆕 Rok produkcji */}
					<div>
						<span className='text-slate-400'>Rok produkcji: </span>
						<span className='text-slate-100'>{yearLabel}</span>
					</div>
					<div>
						<span className='text-slate-400'>Marka / model: </span>
						<span className='text-slate-100'>
							{[batch.brand, batch.model].filter(Boolean).join(' ') || '—'}
						</span>
					</div>
					<div>
						<span className='text-slate-400'>
							Ilość (dostępne / całkowita):{' '}
						</span>
						<span className='text-slate-100'>{qtyLabel}</span>
					</div>
					<div>
						<span className='text-slate-400'>Cena: </span>
						<span className='text-slate-100'>{priceLabel}</span>
					</div>
					<div>
						<span className='text-slate-400'>Właściciel: </span>
						<span className='text-slate-100'>{ownerLabel}</span>
					</div>
					<div>
						<span className='text-slate-400'>Lokalizacja: </span>
						<span className='text-slate-100'>{batch.locationCode || '—'}</span>
					</div>
				</div>
				{batch.notes && (
					<p className='text-xs text-slate-400 pt-2'>
						<span className='font-medium text-slate-300'>Notatki: </span>
						{batch.notes}
					</p>
				)}
			</div>

			{/* Zdjęcia */}
			<div className='space-y-3'>
				<div className='flex items-center justify-between gap-3'>
					<h3 className='text-sm font-semibold text-slate-100'>
						Zdjęcia partii
					</h3>
					<UploadPhotoButton batchId={batch.id} />
				</div>

				{batch.photos.length === 0 ? (
					<p className='text-xs text-slate-400'>
						Brak zdjęć dla tej partii. Dodaj przynajmniej jedno zdjęcie.
					</p>
				) : (
					<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
						{batch.photos.map(photo => (
							<div
								key={photo.id}
								className='border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60 flex flex-col'
							>
								<div className='aspect-[4/3] bg-slate-900'>
									<img
										src={photo.url}
										alt='Zdjęcie opon'
										className='h-full w-full object-cover'
									/>
								</div>
								<div className='p-2 flex items-center justify-between gap-2 text-[10px]'>
									<span
										className={
											'inline-flex items-center rounded-full px-2 py-0.5 border ' +
											(photo.isMain
												? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
												: 'bg-slate-800/60 text-slate-300 border-slate-600')
										}
									>
										{photo.isMain ? 'główne zdjęcie' : 'pomocnicze'}
									</span>
									<PhotoActions photoId={photo.id} isMain={photo.isMain} />
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Ruchy magazynowe */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
				<MovementForm batchId={batch.id} />

				<div className='border border-slate-800 rounded-xl bg-slate-900/40 p-3 space-y-2 text-xs md:text-sm'>
					<div className='flex items-center justify-between'>
						<h3 className='font-semibold text-slate-100'>
							Historia ruchów (ostatnie 20)
						</h3>
					</div>

					{batch.movements.length === 0 ? (
						<p className='text-xs text-slate-400'>
							Brak zapisanych ruchów magazynowych dla tej partii.
						</p>
					) : (
						<div className='max-h-64 overflow-y-auto pr-1'>
							<table className='w-full text-[11px]'>
								<thead className='text-[10px] uppercase text-slate-500 border-b border-slate-800'>
									<tr>
										<th className='py-1 pr-2 text-left'>Data</th>
										<th className='py-1 pr-2 text-left'>Typ</th>
										<th className='py-1 pr-2 text-right'>Ilość</th>
										<th className='py-1 pr-2 text-left'>Opis</th>
									</tr>
								</thead>
								<tbody>
									{batch.movements.map(move => (
										<tr
											key={move.id}
											className='border-b border-slate-800/60 last:border-0'
										>
											<td className='py-1 pr-2 align-top text-slate-300'>
												{new Date(move.createdAt).toLocaleString('pl-PL', {
													dateStyle: 'short',
													timeStyle: 'short',
												})}
											</td>
											<td className='py-1 pr-2 align-top'>
												<span
													className={
														'inline-flex px-2 py-0.5 rounded-full border ' +
														(move.type === 'IN'
															? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
															: move.type === 'OUT'
															? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
															: move.type === 'SCRAP'
															? 'border-red-500/40 bg-red-500/10 text-red-300'
															: 'border-slate-500/40 bg-slate-500/10 text-slate-200')
													}
												>
													{move.type}
												</span>
											</td>
											<td className='py-1 pr-2 align-top text-right text-slate-100'>
												{move.amount}
											</td>
											<td className='py-1 pr-2 align-top text-slate-300'>
												{move.reason || '—'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
