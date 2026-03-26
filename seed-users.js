const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function seedUsers() {
  const adminPw = await bcrypt.hash("admin123", 10);
  const whPw = await bcrypt.hash("warehouse123", 10);
  const mgrPw = await bcrypt.hash("manager123", 10);

  await prisma.user.upsert({ where: { username: "admin" }, update: {}, create: { username: "admin", passwordHash: adminPw, displayName: "Administrator", role: "ADMIN", isActive: true, forcePwChange: true } });
  await prisma.user.upsert({ where: { username: "warehouse1" }, update: {}, create: { username: "warehouse1", passwordHash: whPw, displayName: "Warehouse 1", role: "WAREHOUSE", isActive: true } });
  await prisma.user.upsert({ where: { username: "manager1" }, update: {}, create: { username: "manager1", passwordHash: mgrPw, displayName: "Manager 1", role: "MANAGER", isActive: true } });

  console.log("Users seeded");
  await prisma.$disconnect();
}

seedUsers().catch(e => { console.error(e); process.exit(1); });