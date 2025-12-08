// app/(admin)/batches/[id]/PhotoActions.jsx
'use client'

import message from '../../../../components/message'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PhotoActions({ photoId, isMain }) {
	const [loading, setLoading] = useState(false)
	const router = useRouter()

	async function setAsMain() {
		setLoading(true)
		const close = message.loading('Ustawianie głównego zdjęcia...', {
			position: 'topRight',
		})

		try {
			const res = await fetch(`/api/photos/${photoId}`, {
				method: 'PATCH',
			})

			let data = null
			try {
				data = await res.json()
			} catch {}

			if (!res.ok) {
				throw new Error(data?.error || 'Błąd przy ustawianiu głównego zdjęcia')
			}

			close()
			message.success('Ustawiono jako główne ✅', 2, { position: 'topRight' })
			router.refresh()
		} catch (err) {
			console.error('setAsMain error:', err)
			close()
			message.error(err.message || 'Błąd przy ustawianiu głównego zdjęcia', 3, {
				position: 'topRight',
			})
		} finally {
			setLoading(false)
		}
	}

	async function removePhoto() {
		if (!confirm('Na pewno chcesz usunąć to zdjęcie?')) return

		setLoading(true)
		const close = message.loading('Usuwanie zdjęcia...', {
			position: 'topRight',
		})

		try {
			const res = await fetch(`/api/photos/${photoId}`, {
				method: 'DELETE',
			})

			let data = null
			try {
				data = await res.json()
			} catch {}

			if (!res.ok) {
				throw new Error(data?.error || 'Błąd przy usuwaniu zdjęcia')
			}

			close()
			message.success('Zdjęcie zostało usunięte', 2, {
				position: 'topRight',
			})
			router.refresh()
		} catch (err) {
			console.error('removePhoto error:', err)
			close()
			message.error(err.message || 'Błąd przy usuwaniu zdjęcia', 3, {
				position: 'topRight',
			})
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='flex flex-col items-end gap-1 text-[10px]'>
			<div className='flex gap-1'>
				{!isMain && (
					<button
						type='button'
						onClick={setAsMain}
						disabled={loading}
						className='px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed'
					>
						ustaw jako główne
					</button>
				)}
				<button
					type='button'
					onClick={removePhoto}
					disabled={loading}
					className='px-2 py-0.5 rounded-md bg-red-700/80 hover:bg-red-600 text-red-50 disabled:opacity-60 disabled:cursor-not-allowed'
				>
					usuń
				</button>
			</div>
		</div>
	)
}
