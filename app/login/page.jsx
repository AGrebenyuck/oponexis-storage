// app/login/page.jsx
import { Suspense } from 'react'
import LoginPageInner from './LoginPageInner'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className='min-h-screen flex items-center justify-center text-slate-300'>
					Ładowanie formularza logowania...
				</div>
			}
		>
			<LoginPageInner />
		</Suspense>
	)
}
