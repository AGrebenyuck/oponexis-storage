export default function BatchesPage() {
	return (
		<div className='space-y-4'>
			<div>
				<h2 className='text-xl font-semibold tracking-tight'>Партии шин</h2>
				<p className='text-sm text-slate-400'>
					Здесь будет список всех партий: склад, хранение, продажи.
				</p>
			</div>

			<div className='border border-dashed border-slate-700 rounded-xl p-6 text-sm text-slate-400'>
				Таблица пока не реализована. На следующем шаге:
				<ul className='list-disc list-inside mt-2 space-y-1'>
					<li>Добавим модели Prisma (TireBatch, TirePhoto и т.д.)</li>
					<li>Сделаем миграцию в NeonDB</li>
					<li>Подтянем данные сюда и нарисуем таблицу</li>
				</ul>
			</div>
		</div>
	)
}
