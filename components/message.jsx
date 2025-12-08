'use client'

import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import clsx from 'clsx'

// === Контейнеры по позициям (stack mode + разные углы экрана) ===

const POSITION_CLASSES = {
	topCenter: 'top-6 left-1/2 -translate-x-1/2 items-center',
	topRight: 'top-6 right-6 items-end',
	bottomRight: 'bottom-6 right-6 items-end',
	bottomCenter: 'bottom-6 left-1/2 -translate-x-1/2 items-center',
}

const containers = {}

function getContainer(position = 'topCenter') {
	if (typeof window === 'undefined') return null

	if (containers[position]) return containers[position]

	const div = document.createElement('div')
	div.dataset.position = position
	div.className = [
		'fixed z-[9999] flex flex-col space-y-2 pointer-events-none',
		POSITION_CLASSES[position] || POSITION_CLASSES.topCenter,
	].join(' ')

	document.body.appendChild(div)
	containers[position] = div
	return div
}

// === Сам компонент тоста (без локального состояния) ===

const Message = ({
	type = 'info',
	content,
	duration = 3,
	autoClose = true,
	onClose,
}) => {
	useEffect(() => {
		// только авто-закрытие по таймеру
		if (!autoClose || duration <= 0) return

		const timer = setTimeout(() => {
			onClose()
		}, duration * 1000)

		return () => clearTimeout(timer)
	}, [autoClose, duration, onClose])

	const typeStyles = {
		success:
			'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-emerald-900/10',
		error: 'bg-red-50 text-red-900 border-red-300 shadow-red-900/10',
		warning:
			'bg-amber-50 text-amber-900 border-amber-300 shadow-amber-900/10',
		info: 'bg-sky-50 text-sky-900 border-sky-300 shadow-sky-900/10',
		loading:
			'bg-slate-900 text-slate-100 border-slate-700 shadow-slate-900/40',
	}

	const spinner =
		type === 'loading' ? (
			<span
				className='inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent'
				aria-hidden='true'
			/>
		) : null

	return (
		<div
			className={clsx(
				'pointer-events-auto px-4 py-3 border-l-4 rounded-md shadow-lg text-sm flex items-center gap-2',
				'transition-all duration-200 opacity-100 translate-y-0 scale-100',
				'animate-[fadeSlideIn_0.18s_ease-out]',
				typeStyles[type] || typeStyles.info
			)}
		>
			{spinner}
			<div className='grow'>{content}</div>

			{/* Крестик показываем только для "липких" сообщений (autoClose = false, напр. loading) */}
			{!autoClose && (
				<button
					type='button'
					onClick={onClose}
					className='ml-2 text-xs opacity-70 hover:opacity-100'
				>
					✕
				</button>
			)}
		</div>
	)
}

// === Публичный API ===

const message = {
	/**
	 * Базовый метод
	 *
	 * @param {'success'|'error'|'warning'|'info'|'loading'} type
	 * @param {string|JSX.Element} content
	 * @param {number|object} durationOrOptions
	 * @param {object} [maybeOptions]
	 * @returns {() => void} функция для закрытия (используется в loading)
	 */
	show(type, content, durationOrOptions, maybeOptions) {
		if (typeof window === 'undefined') return () => {}

		let duration = 3
		let options = {}

		if (typeof durationOrOptions === 'number') {
			duration = durationOrOptions
		} else if (
			typeof durationOrOptions === 'object' &&
			durationOrOptions !== null
		) {
			options = durationOrOptions
		}

		if (
			typeof maybeOptions === 'object' &&
			maybeOptions !== null
		) {
			options = { ...options, ...maybeOptions }
		}

		const {
			position = 'topCenter',
			sticky = false, // sticky = true → без автозакрытия
		} = options

		const container = getContainer(position)
		if (!container) return () => {}

		const wrap = document.createElement('div')
		container.appendChild(wrap)

		const root = createRoot(wrap)

		const handleClose = () => {
			root.unmount()
			if (wrap.parentNode === container) {
				container.removeChild(wrap)
			}
		}

		root.render(
			<Message
				type={type}
				content={content}
				duration={duration}
				autoClose={!sticky && type !== 'loading'}
				onClose={handleClose}
			/>
		)

		return handleClose
	},

	success(content, durationOrOptions, maybeOptions) {
		return this.show('success', content, durationOrOptions, maybeOptions)
	},
	error(content, durationOrOptions, maybeOptions) {
		return this.show('error', content, durationOrOptions, maybeOptions)
	},
	warning(content, durationOrOptions, maybeOptions) {
		return this.show('warning', content, durationOrOptions, maybeOptions)
	},
	info(content, durationOrOptions, maybeOptions) {
		return this.show('info', content, durationOrOptions, maybeOptions)
	},

	/**
	 * loading: возвращает функцию close()
	 *
	 * Пример:
	 *   const close = message.loading('Zapisywanie...')
	 *   ...
	 *   close()
	 */
	loading(content, durationOrOptions, maybeOptions) {
		let options = {}
		if (typeof durationOrOptions === 'object' && durationOrOptions !== null) {
			options = durationOrOptions
		} else if (
			typeof maybeOptions === 'object' &&
			maybeOptions !== null
		) {
			options = maybeOptions
		}

		const mergedOptions = { sticky: true, ...options }
		return this.show('loading', content, 0, mergedOptions)
	},
}

export default message