export default function HomePage() {
	return (
		<main className='min-h-screen flex items-center justify-center bg-slate-950 text-slate-50'>
			<div className='max-w-xl text-center space-y-4'>
				<h1 className='text-3xl font-semibold tracking-tight'>
					Oponexis Tires – panel wewnętrzny
				</h1>
				<p className='text-slate-300'>
					To jest wewnętrzny panel administracyjny do zarządzania magazynem i
					przechowywaniem opon.
				</p>
				<p className='text-xs text-slate-500'>
					Główna praca odbywa się w sekcji{' '}
					<span className='font-semibold'>„Partie opon”</span>.
				</p>
			</div>
		</main>
	)
}
