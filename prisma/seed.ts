import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ============================================
  // 1. Product Categories (หมวดหมู่สินค้า)
  // ============================================
  const categories = [
    { nameTh: 'ฟิลเลอร์', nameEn: 'Filler' },
    { nameTh: 'เมโส', nameEn: 'Meso' },
    { nameTh: 'สกินแคร์', nameEn: 'Skincare' },
    { nameTh: 'ยา', nameEn: 'Medicine' },
    { nameTh: 'เครื่องมือแพทย์', nameEn: 'Medical Device' },
    { nameTh: 'เครื่องสำอาง', nameEn: 'Cosmetic' },
    { nameTh: 'อื่นๆ', nameEn: 'Other' },
  ]

  for (const cat of categories) {
    await prisma.productCategory.upsert({
      where: { id: categories.indexOf(cat) + 1 },
      update: {},
      create: cat,
    })
  }
  console.log('✅ Product categories seeded')

  // ============================================
  // 2. Units (หน่วยนับ)
  // ============================================
  const units = [
    { nameTh: 'ชิ้น', nameEn: 'Piece' },
    { nameTh: 'กล่อง', nameEn: 'Box' },
    { nameTh: 'ขวด', nameEn: 'Bottle' },
    { nameTh: 'ซอง', nameEn: 'Sachet' },
    { nameTh: 'หลอด', nameEn: 'Tube' },
    { nameTh: 'เส้น', nameEn: 'Thread' },
    { nameTh: 'ชุด', nameEn: 'Set' },
    { nameTh: 'แพ็ก', nameEn: 'Pack' },
  ]

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { id: units.indexOf(unit) + 1 },
      update: {},
      create: unit,
    })
  }
  console.log('✅ Units seeded')

  // ============================================
  // 3. Shipping Methods (วิธีการส่ง)
  // ============================================
  const shippingMethods = [
    { nameTh: 'GRAB', nameEn: 'GRAB' },
    { nameTh: 'ปณ', nameEn: 'Thailand Post' },
    { nameTh: 'Inter express', nameEn: 'Inter Express' },
    { nameTh: 'ผู้แทน', nameEn: 'Representative' },
    { nameTh: 'Messenger', nameEn: 'Messenger' },
    { nameTh: 'รับเองที่คลัง', nameEn: 'Self Pickup' },
  ]

  for (const method of shippingMethods) {
    await prisma.shippingMethod.upsert({
      where: { id: shippingMethods.indexOf(method) + 1 },
      update: {},
      create: method,
    })
  }
  console.log('✅ Shipping methods seeded')

  // ============================================
  // 4. Warehouses (คลังสินค้า)
  // ============================================
  const warehouses = [
    { name: 'คลังหลัก' },
    { name: 'คลังสาขา A' },
    { name: 'คลังสาขา B' },
  ]

  for (const wh of warehouses) {
    await prisma.warehouse.upsert({
      where: { id: warehouses.indexOf(wh) + 1 },
      update: {},
      create: wh,
    })
  }
  console.log('✅ Warehouses seeded')

  // ============================================
  // 5. Default Admin User
  // ============================================
  const adminPassword = await bcrypt.hash('admin123', 10)

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      displayName: 'Administrator',
      role: UserRole.ADMIN,
      isActive: true,
      forcePwChange: true, // บังคับเปลี่ยน password ครั้งแรก
    },
  })
  console.log('✅ Admin user seeded (username: admin, password: admin123)')

  // ============================================
  // 6. Sample Users (for testing)
  // ============================================
  const warehousePassword = await bcrypt.hash('warehouse123', 10)
  const managerPassword = await bcrypt.hash('manager123', 10)

  await prisma.user.upsert({
    where: { username: 'warehouse1' },
    update: {},
    create: {
      username: 'warehouse1',
      passwordHash: warehousePassword,
      displayName: 'พนักงานคลัง 1',
      role: UserRole.WAREHOUSE,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { username: 'manager1' },
    update: {},
    create: {
      username: 'manager1',
      passwordHash: managerPassword,
      displayName: 'ผู้จัดการ 1',
      role: UserRole.MANAGER,
      isActive: true,
    },
  })
  console.log('✅ Sample users seeded')

  // ============================================
  // 7. Sample Clinics
  // ============================================
  const clinics = [
    { name: 'ABC Clinic', province: 'กรุงเทพมหานคร', branchName: 'สาขาสยาม' },
    { name: 'Beauty Center', province: 'ภูเก็ต', branchName: null },
    { name: 'Skin Care Plus', province: 'เชียงใหม่', branchName: 'สาขานิมมาน' },
  ]

  for (const clinic of clinics) {
    await prisma.clinic.upsert({
      where: { id: clinics.indexOf(clinic) + 1 },
      update: {},
      create: clinic,
    })
  }
  console.log('✅ Sample clinics seeded')

  // ============================================
  // 8. Product Masters (ข้อมูลหลักสินค้า)
  // ============================================
  const productMasters = [
    // Filler (categoryId: 1)
    { sku: 'FIL-001', nameTh: 'Juvederm Ultra Plus XC', nameEn: 'Juvederm Ultra Plus XC', categoryId: 1, modelSize: '1ml', defaultUnitId: 1 },
    { sku: 'FIL-002', nameTh: 'Restylane', nameEn: 'Restylane', categoryId: 1, modelSize: '1ml', defaultUnitId: 1 },
    { sku: 'FIL-003', nameTh: 'Teosyal RHA', nameEn: 'Teosyal RHA', categoryId: 1, modelSize: '1ml', defaultUnitId: 1 },
    { sku: 'FIL-004', nameTh: 'Belotero Balance', nameEn: 'Belotero Balance', categoryId: 1, modelSize: '1ml', defaultUnitId: 1 },
    // Meso (categoryId: 2)
    { sku: 'MES-001', nameTh: 'NCTF 135HA', nameEn: 'NCTF 135HA', categoryId: 2, modelSize: '3ml', defaultUnitId: 1 },
    { sku: 'MES-002', nameTh: 'Dermaheal SB', nameEn: 'Dermaheal SB', categoryId: 2, modelSize: '5ml', defaultUnitId: 1 },
    { sku: 'MES-003', nameTh: 'Hyaluronic Acid Meso', nameEn: 'Hyaluronic Acid Meso', categoryId: 2, modelSize: '5ml', defaultUnitId: 3 },
    // Skincare (categoryId: 3)
    { sku: 'SKC-001', nameTh: 'Vitamin C Serum', nameEn: 'Vitamin C Serum', categoryId: 3, modelSize: '30ml', defaultUnitId: 3 },
    { sku: 'SKC-002', nameTh: 'Retinol Cream', nameEn: 'Retinol Cream', categoryId: 3, modelSize: '50g', defaultUnitId: 5 },
    { sku: 'SKC-003', nameTh: 'Sunscreen SPF50', nameEn: 'Sunscreen SPF50', categoryId: 3, modelSize: '30ml', defaultUnitId: 5 },
    // Medicine (categoryId: 4)
    { sku: 'MED-001', nameTh: 'Botulinum Toxin Type A', nameEn: 'Botulinum Toxin Type A', categoryId: 4, modelSize: '100 units', defaultUnitId: 1 },
    { sku: 'MED-002', nameTh: 'Lidocaine 2%', nameEn: 'Lidocaine 2%', categoryId: 4, modelSize: '20ml', defaultUnitId: 3 },
    // Medical Device (categoryId: 5)
    { sku: 'DEV-001', nameTh: 'PDO Thread COG', nameEn: 'PDO Thread COG', categoryId: 5, modelSize: '19G x 100mm', defaultUnitId: 6 },
    { sku: 'DEV-002', nameTh: 'PDO Thread Mono', nameEn: 'PDO Thread Mono', categoryId: 5, modelSize: '29G x 38mm', defaultUnitId: 6 },
  ]

  for (const pm of productMasters) {
    await prisma.productMaster.upsert({
      where: { sku: pm.sku },
      update: {},
      create: pm,
    })
  }
  console.log('✅ Product masters seeded')

  // ============================================
  // 9. Sequence Counters
  // ============================================
  const year = new Date().getFullYear()

  const counters = [
    { name: 'SERIAL', prefix: '', currentVal: BigInt(0) },
    { name: 'GRN', prefix: `GRN-${year}-`, currentVal: BigInt(0) },
    { name: 'OUTBOUND', prefix: `OUT-${year}-`, currentVal: BigInt(0) },
  ]

  for (const counter of counters) {
    await prisma.sequenceCounter.upsert({
      where: { name: counter.name },
      update: { prefix: counter.prefix }, // Update prefix for new year
      create: counter,
    })
  }
  console.log('✅ Sequence counters seeded')

  console.log('')
  console.log('🎉 Database seeding completed!')
  console.log('')
  console.log('📋 Test Accounts:')
  console.log('   Admin:     admin / admin123 (force password change)')
  console.log('   Warehouse: warehouse1 / warehouse123')
  console.log('   Manager:   manager1 / manager123')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
