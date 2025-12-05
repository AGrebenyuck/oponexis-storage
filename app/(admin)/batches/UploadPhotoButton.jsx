'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPhotoButton({ batchId }) {
	const inputRef = useRef(null)
	const [isUploading, setIsUploading] = useState(false)
	const [error, setError] = useState(null)
	const router = useRouter()

	function handleClick() {
		setError(null)
		if (inputRef.current) {
			inputRef.current.click()
		}
	}

	const MAX_FILE_SIZE = 10 * 1024 * 1024

	async function handleFileChange(e) {
		const file = e.target.files?.[0]
		if (!file) return
		if (file.size && file.size > MAX_FILE_SIZE) {
			alert(
				`Plik "${file.name}" jest zbyt duży. Maksymalny rozmiar to 10 MB (limit Cloudinary).`
			)
			e.target.value = ''
			return
		}

		setIsUploading(true)
		setError(null)

		try {
			const formData = new FormData()
			formData.append('file', file)

			const res = await fetch(`/api/batches/${batchId}/photos`, {
				method: 'POST',
				body: formData,
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Błąd przesyłania zdjęcia')
			}

			// очищаем инпут, чтобы можно было выбрать тот же файл ещё раз при необходимости
			e.target.value = ''
			router.refresh()
		} catch (err) {
			console.error('Upload photo error:', err)
			setError(err.message)
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
			{error && (
				<span className='text-[10px] text-red-400 max-w-[140px]'>{error}</span>
			)}
		</div>
	)
}
