export default function HomePage() {
	return (
		<main className='min-h-screen flex items-center justify-center bg-slate-950 text-slate-50'>
			<div className='max-w-xl text-center space-y-4'>
				<h1 className='text-3xl font-semibold tracking-tight'>
					Oponexis Tires Admin
				</h1>
				<p className='text-slate-300'>
					Здесь будет админка для учёта шин: склад, хранение и продажи.
				</p>
				<p className='text-xs text-slate-500'>
					Пока это заглушка. Далее добавим страницу /admin/batches.
				</p>
			</div>
		</main>
	)
}
