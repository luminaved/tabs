// Выдаёт или снимает права администратора.
// Запуск:  node scripts/grant-admin.mjs <email> [--revoke]
//
// Роль хранится в User.role и через интерфейс не меняется — только этим
// скриптом. Аккаунт должен уже существовать: пользователь создаётся входом,
// а не здесь, иначе можно было бы «занять» чужой адрес пустой записью.
import { PrismaClient } from '@prisma/client';

const [, , rawEmail, ...flags] = process.argv;
const revoke = flags.includes('--revoke');

if (!rawEmail) {
  console.error('Укажите email: node scripts/grant-admin.mjs <email> [--revoke]');
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, name: true, role: true },
});

if (!user) {
  console.error(
    `Аккаунт ${email} не найден. Сначала зарегистрируйтесь этим адресом, потом повторите.`,
  );
  await prisma.$disconnect();
  process.exit(1);
}

const role = revoke ? 'user' : 'admin';
if (user.role === role) {
  console.log(`${email}: роль уже "${role}", менять нечего.`);
} else {
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${email}: роль "${user.role}" → "${role}".`);
}

await prisma.$disconnect();
