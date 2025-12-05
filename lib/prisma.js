// lib/prisma.js
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		log: ['error', 'warn'], // можно добавить 'query' при необходимости
	})

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma
}
