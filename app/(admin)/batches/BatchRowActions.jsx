'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export default function BatchRowActions({ batchId }) {
	const [open, setOpen] = useState(false)
	const [loadingDelete, setLoadingDelete] = useState(false)
	const [loadingUpload, setLoadingUpload] = useState(false)
	const menuRef = useRef(null)
	const fileInputRef = useRef(null)
	const router = useRouter()

	function toggleMenu() {
		setOpen(prev => !prev)
	}

	// закрытие по клику вне меню
	useEffect(() => {
		if (!open) return

		function handleClickOutside(e) {
			if (menuRef.current && !menuRef.current.contains(e.target)) {
				setOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [open])

	function handleEdit() {
		setOpen(false)
		router.push(`/batches/${batchId}`)
	}

	function handleAddPhotoClick() {
		if (fileInputRef.current) {
			fileInputRef.current.click()
		}
	}

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

		setLoadingUpload(true)

		try {
			const fd = new FormData()
			fd.append('file', file)

			const res = await fetch(`/api/batches/${batchId}/photos`, {
				method: 'POST',
				body: fd,
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Nie udało się przesłać zdjęcia.')
			}

			router.refresh()
		} catch (err) {
			console.error('Upload photo error:', err)
			alert(err.message || 'Nie udało się przesłać zdjęcia.')
		} finally {
			setLoadingUpload(false)
			e.target.value = ''
			setOpen(false)
		}
	}

	async function handleDelete() {
		const ok = window.confirm(
			'Na pewno chcesz usunąć tę partię oraz wszystkie powiązane zdjęcia i ruchy magazynowe?'
		)

		if (!ok) return

		setLoadingDelete(true)

		try {
			const res = await fetch(`/api/batches/${batchId}`, {
				method: 'DELETE',
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Nie udało się usunąć partii.')
			}

			router.refresh()
		} catch (err) {
			console.error('Delete batch error:', err)
			alert(err.message || 'Nie udało się usunąć partii.')
		} finally {
			setLoadingDelete(false)
			setOpen(false)
		}
	}

	return (
		<div ref={menuRef} className='relative inline-block text-left'>
			{/* скрытый input для загрузки фото */}
			<input
				ref={fileInputRef}
				type='file'
				accept='image/*'
				className='hidden'
				onChange={handleFileChange}
			/>

			<button
				type='button'
				onClick={toggleMenu}
				className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700'
			>
				Menu
				<span className='ml-1 text-[10px] text-slate-300'>▾</span>
			</button>

			{open && (
				<div className='absolute right-0 mt-1 w-44 origin-top-right rounded-md border border-slate-800 bg-slate-900 shadow-lg z-20'>
					<div className='py-1 text-xs text-slate-100'>
						<button
							type='button'
							onClick={handleEdit}
							className='w-full px-3 py-1.5 text-left hover:bg-slate-800'
						>
							Edytuj
						</button>

						<button
							type='button'
							onClick={handleAddPhotoClick}
							className='w-full px-3 py-1.5 text-left hover:bg-slate-800 disabled:opacity-60'
							disabled={loadingUpload}
						>
							{loadingUpload ? 'Dodawanie zdjęcia…' : 'Dodaj zdjęcie'}
						</button>

						<div className='my-1 border-t border-slate-800' />

						<button
							type='button'
							onClick={handleDelete}
							className='w-full px-3 py-1.5 text-left text-red-300 hover:bg-red-950/40 disabled:opacity-60'
							disabled={loadingDelete}
						>
							{loadingDelete ? 'Usuwanie…' : 'Usuń partię'}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
