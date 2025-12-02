// lib/prisma.js
import { PrismaClient } from '@/generated/prisma' // путь из output в schema.prisma
import { PrismaPg } from '@prisma/adapter-pg'
import pkg from 'pg'

const { Pool } = pkg

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
	console.warn(
		'[prisma] DATABASE_URL is not set – PrismaClient will fail to connect'
	)
}

// Чтобы в dev не плодить коннекты – используем globalThis
let prisma
let pool

if (process.env.NODE_ENV === 'production') {
	pool = new Pool({ connectionString })
	const adapter = new PrismaPg(pool)
	prisma = new PrismaClient({ adapter })
} else {
	if (!globalThis._pgPool) {
		globalThis._pgPool = new Pool({ connectionString })
	}
	if (!globalThis._prisma) {
		const adapter = new PrismaPg(globalThis._pgPool)
		globalThis._prisma = new PrismaClient({ adapter })
	}
	pool = globalThis._pgPool
	prisma = globalThis._prisma
}

export { prisma, pool }
