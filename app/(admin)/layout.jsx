export const metadata = {
	title: 'Oponexis Tires – panel administracyjny',
}

export default function AdminLayout({ children }) {
	return (
		<html lang='pl'>
			<body className='min-h-screen bg-slate-950 text-slate-50'>
				<div className='flex min-h-screen'>
					<aside className='hidden md:block w-64 border-r border-slate-800 bg-slate-900/60'>
						<div className='p-4 border-b border-slate-800'>
							<div className='text-lg font-semibold tracking-tight'>
								Oponexis Tires
							</div>
							<div className='text-xs text-slate-400'>
								Magazyn i przechowywanie opon
							</div>
						</div>
						<nav className='p-4 space-y-2 text-sm'>
							<a
								href='/batches'
								className='block px-3 py-2 rounded-lg hover:bg-slate-800/80'
							>
								Partie opon
							</a>
							{/* później dodamy inne sekcje */}
						</nav>
					</aside>
					<main className='flex-1'>
						<header className='border-b border-slate-800 bg-slate-900/50 backdrop-blur'>
							<div className='px-4 py-3 flex items-center justify-between'>
								<h1 className='text-sm font-medium text-slate-200'>
									Panel administracyjny
								</h1>
								<div className='text-xs text-slate-500'>
									tylko do użytku wewnętrznego
								</div>
							</div>
						</header>
						<div className='p-4 md:p-6'>{children}</div>
					</main>
				</div>
			</body>
		</html>
	)
}
