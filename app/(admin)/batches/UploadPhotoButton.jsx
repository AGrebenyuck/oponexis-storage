// app/(admin)/batches/UploadPhotoButton.jsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import message from '../../../components/message'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function UploadPhotoButton({ batchId }) {
	const inputRef = useRef(null)
	const [isUploading, setIsUploading] = useState(false)
	const router = useRouter()

	function handleClick() {
		if (inputRef.current) {
			inputRef.current.click()
		}
	}

	async function handleFileChange(e) {
		const file = e.target.files?.[0]
		if (!file) return

		if (file.size && file.size > MAX_FILE_SIZE) {
			message.warning(
				`Plik "${file.name}" jest zbyt duży. Maksymalny rozmiar to 10 MB.`,
				4,
				{ position: 'topRight' }
			)
			e.target.value = ''
			return
		}

		setIsUploading(true)
		const close = message.loading('Przesyłanie zdjęcia...', {
			position: 'topRight',
		})

		try {
			const formData = new FormData()
			formData.append('file', file)

			const res = await fetch(`/api/batches/${batchId}/photos`, {
				method: 'POST',
				body: formData,
			})

			let data = null
			try {
				data = await res.json()
			} catch {}

			if (!res.ok) {
				throw new Error(data?.error || 'Błąd przesyłania zdjęcia')
			}

			close()
			message.success('Zdjęcie zostało dodane ✅', 2, {
				position: 'topRight',
			})

			e.target.value = ''
			router.refresh()
		} catch (err) {
			console.error('Upload photo error:', err)
			close()
			message.error(err.message || 'Błąd przesyłania zdjęcia', 3, {
				position: 'topRight',
			})
		} finally {
			setIsUploading(false)
		}
	}

	return (
		<div className='flex flex-col gap-1'>
			<button
				type='button'
				onClick={handleClick}
				disabled={isUploading}
				className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed'
			>
				{isUploading ? 'Przesyłanie...' : 'Dodaj zdjęcie'}
			</button>
			<input
				ref={inputRef}
				type='file'
				accept='image/*'
				className='hidden'
				onChange={handleFileChange}
			/>
		</div>
	)
}
