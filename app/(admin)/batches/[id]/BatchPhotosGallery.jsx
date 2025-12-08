// app/(admin)/batches/[id]/BatchPhotosGallery.jsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import PhotoActions from './PhotoActions'

export default function BatchPhotosGallery({ photos }) {
	const [isOpen, setIsOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	const hasPhotos = Array.isArray(photos) && photos.length > 0

	const openLightbox = index => {
		setActiveIndex(index)
		setIsOpen(true)
	}

	const closeLightbox = () => {
		setIsOpen(false)
	}

	const showPrev = useCallback(() => {
		if (!hasPhotos) return
		setActiveIndex(prev => (prev - 1 + photos.length) % photos.length)
	}, [hasPhotos, photos])

	const showNext = useCallback(() => {
		if (!hasPhotos) return
		setActiveIndex(prev => (prev + 1) % photos.length)
	}, [hasPhotos, photos])

	// ESC / ← → навигация
	useEffect(() => {
		if (!isOpen) return

		function handleKeyDown(e) {
			if (e.key === 'Escape') {
				e.preventDefault()
				closeLightbox()
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault()
				showPrev()
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault()
				showNext()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, showPrev, showNext])

	if (!hasPhotos) {
		return (
			<p className='text-xs text-slate-400'>
				Brak zdjęć dla tej partii. Dodaj przynajmniej jedno zdjęcie.
			</p>
		)
	}

	const activePhoto = photos[activeIndex]

	return (
		<>
			{/* Сетка превью */}
			<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
				{photos.map((photo, index) => (
					<div
						key={photo.id}
						className='border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60 flex flex-col'
					>
						<button
							type='button'
							onClick={() => openLightbox(index)}
							className='aspect-[4/3] bg-slate-900 block w-full focus:outline-none focus:ring-2 focus:ring-emerald-500'
						>
							<img
								src={photo.url}
								alt='Zdjęcie opon'
								className='h-full w-full object-cover'
							/>
						</button>
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

			{/* Лайтбокс / полноэкранный просмотр */}
			{isOpen && activePhoto && (
				<div
					className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 md:p-6'
					onClick={closeLightbox}
				>
					<div
						className='relative max-w-full max-h-full flex flex-col items-center'
						onClick={e => e.stopPropagation()} // чтобы клик по картинке не закрывал
					>
						{/* Кнопка закрытия */}
						<button
							type='button'
							onClick={closeLightbox}
							className='absolute -top-2 -right-2 md:-top-4 md:-right-4 h-8 w-8 rounded-full bg-black/70 flex items-center justify-center text-slate-100 text-lg shadow-lg border border-slate-700'
						>
							×
						</button>

						{/* Картинка */}
						<div className='flex items-center justify-center max-w-[95vw] max-h-[80vh]'>
							<img
								src={activePhoto.url}
								alt='Podgląd zdjęcia opon'
								className='max-h-[80vh] max-w-[95vw] object-contain rounded-lg shadow-xl'
							/>
						</div>

						{/* Навигация + индекс */}
						{photos.length > 1 && (
							<div className='mt-3 flex items-center gap-4 text-xs text-slate-200'>
								<button
									type='button'
									onClick={showPrev}
									className='px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600'
								>
									← Poprzednie
								</button>
								<span className='text-[11px] text-slate-300'>
									{activeIndex + 1} / {photos.length}
								</span>
								<button
									type='button'
									onClick={showNext}
									className='px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600'
								>
									Następne →
								</button>
							</div>
						)}
					</div>
				</div>
			)}
		</>
	)
}
