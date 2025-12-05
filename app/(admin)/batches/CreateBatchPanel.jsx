'use client'

import { useEffect, useRef, useState } from 'react'
import CreateBatchForm from './CreateBatchForm'

export default function CreateBatchPanel() {
	const [open, setOpen] = useState(false)
	const panelRef = useRef(null)

	function toggle() {
		setOpen(prev => !prev)
	}

	// при открытии на мобиле — скроллим к панели
	useEffect(() => {
		if (open && panelRef.current) {
			panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}, [open])

	return (
		<div ref={panelRef} className='space-y-2'>
			<button
				type='button'
				onClick={toggle}
				className='inline-flex items-center rounded-md bg-emerald-500 px-3 py-2 text-xs md:text-sm font-medium text-emerald-950 hover:bg-emerald-400'
			>
				{open ? 'Ukryj formularz partii' : 'Dodaj partię opon'}
			</button>

			<div
				className={[
					'overflow-hidden transition-all duration-300 ease-out',
					open
						? 'opacity-100 translate-y-0 max-h-[2000px]'
						: 'opacity-0 -translate-y-2 max-h-0 pointer-events-none',
				].join(' ')}
			>
				{/* небольшой паддинг сверху, чтобы форма не прилипала к кнопке */}
				<div className='mt-2'>
					<CreateBatchForm />
				</div>
			</div>
		</div>
	)
}
