// app/login/LoginPageInner.jsx
'use client'

import { useSearchParams } from 'next/navigation'

export default function LoginPageInner() {
	const searchParams = useSearchParams()
	const error = searchParams.get('error') // пример

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

				{/* тут твоя форма логина */}
				<form className='space-y-3'>
					<div className='space-y-1'>
						<label className='block text-xs text-slate-300'>Hasło</label>
						<input
							type='password'
							name='password'
							className='w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-50'
						/>
					</div>

					<button
						type='submit'
						className='mt-2 w-full rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-400'
					>
						Zaloguj się
					</button>
				</form>
			</div>
		</div>
	)
}
