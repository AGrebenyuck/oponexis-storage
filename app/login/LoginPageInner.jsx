// app/login/LoginPageInner.jsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function LoginPageInner() {
	const [password, setPassword] = useState('')
	const [error, setError] = useState(null)
	const [loading, setLoading] = useState(false)

	const router = useRouter()
	const searchParams = useSearchParams()
	const redirect = searchParams.get('redirect') || '/batches'

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
				throw new Error(data.error || 'Nie udało się zalogować')
			}

			// успех → уходим туда, откуда нас выкинул middleware
			router.push(redirect)
		} catch (err) {
			console.error('Login error:', err)
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='min-h-screen flex items-center justify-center bg-slate-950'>
			<div className='w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg'>
				<h1 className='text-lg font-semibold text-slate-50 mb-3'>
					Logowanie do panelu
				</h1>

				{error && (
					<div className='mb-3 rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-200'>
						Błąd: {error}
					</div>
				)}

				<form onSubmit={handleSubmit} className='space-y-3'>
					<div className='space-y-1'>
						<label className='block text-xs text-slate-300'>Hasło</label>
						<input
							type='password'
							name='password'
							value={password}
							onChange={e => setPassword(e.target.value)}
							className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50'
							placeholder='••••••'
						/>
					</div>

					<button
						type='submit'
						disabled={loading || !password}
						className='mt-2 w-full rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed'
					>
						{loading ? 'Logowanie...' : 'Zaloguj się'}
					</button>
				</form>

				<p className='mt-3 text-[11px] text-slate-500'>
					Po poprawnym logowaniu zostaniesz przeniesiony do:{' '}
					<span className='font-mono break-all'>{redirect}</span>
				</p>
			</div>
		</div>
	)
}
