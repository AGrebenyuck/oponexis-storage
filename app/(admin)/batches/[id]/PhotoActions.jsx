'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PhotoActions({ photoId, isMain }) {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const router = useRouter()

	async function setAsMain() {
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`/api/photos/${photoId}`, {
				method: 'PATCH',
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Błąd przy ustawianiu głównego zdjęcia')
			}

			router.refresh()
		} catch (err) {
			console.error('setAsMain error:', err)
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	async function removePhoto() {
		if (!confirm('Na pewno chcesz usunąć to zdjęcie?')) return

		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`/api/photos/${photoId}`, {
				method: 'DELETE',
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Błąd przy usuwaniu zdjęcia')
			}

			router.refresh()
		} catch (err) {
			console.error('removePhoto error:', err)
			setError(err.message)
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
			{error && <span className='text-red-400'>{error}</span>}
		</div>
	)
}
