import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../lib/seedDatabase.js';

const ifEmpty = process.argv.includes('--if-empty');
const prisma = new PrismaClient();

seedDatabase(prisma, { ifEmpty })
  .then((result) => {
    console.log(result === 'skipped' ? '已經有資料,略過 seed。' : '種子資料寫入完成。');
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
