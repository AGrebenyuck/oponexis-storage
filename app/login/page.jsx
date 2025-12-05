'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
	const [password, setPassword] = useState('')
	const [error, setError] = useState(null)
	const [loading, setLoading] = useState(false)
	const router = useRouter()
	const searchParams = useSearchParams()

	const from = searchParams.get('from') || '/batches'

	async function handleSubmit(e) {
		e.preventDefault()
		setError(null)
		setLoading(true)

		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Nie udało się zalogować.')
			}

			router.push(from)
			router.refresh()
		} catch (err) {
			console.error('login error:', err)
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className='min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4'>
			<div className='w-full max-w-sm border border-slate-800 rounded-2xl bg-slate-900/80 p-6 space-y-4'>
				<div className='space-y-1'>
					<h1 className='text-lg font-semibold tracking-tight'>
						Logowanie do panelu
					</h1>
					<p className='text-xs text-slate-400'>
						Panel wewnętrzny Oponexis Tires. Wprowadź hasło administratora.
					</p>
				</div>

				<form onSubmit={handleSubmit} className='space-y-3'>
					<div className='space-y-1'>
						<label className='block text-xs text-slate-300'>Hasło</label>
						<input
							type='password'
							value={password}
							onChange={e => setPassword(e.target.value)}
							className='w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50'
							placeholder='••••••••'
							required
						/>
					</div>

					{error && <p className='text-xs text-red-400'>{error}</p>}

					<button
						type='submit'
						disabled={loading}
						className='w-full inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed'
					>
						{loading ? 'Logowanie…' : 'Zaloguj się'}
					</button>
				</form>

				<p className='text-[10px] text-slate-500 text-center'>
					Dostęp wyłącznie dla personelu serwisu.
				</p>
			</div>
		</main>
	)
}
