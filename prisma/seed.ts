import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ============================================
  // 1. Product Categories (หมวดหมู่สินค้า)
  // ============================================
  const categories = [
    { nameTh: 'ยา', nameEn: 'Medicine', serialCode: 'A' },
    { nameTh: 'เครื่องมือแพทย์', nameEn: 'Medical Instruments', serialCode: 'B' },
    { nameTh: 'เครื่องสำอาง', nameEn: 'Cosmetic', serialCode: 'C' },
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
    { nameTh: 'กล่อง', nameEn: 'Box' },
    { nameTh: 'ขวด', nameEn: 'Bottle' },
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
  const marketingPassword = await bcrypt.hash('marketing123', 10)

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

  await prisma.user.upsert({
    where: { username: 'marketing1' },
    update: {},
    create: {
      username: 'marketing1',
      passwordHash: marketingPassword,
      displayName: 'การตลาด 1',
      role: UserRole.MARKETING,
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
    // Medicine (categoryId: 1)
    { sku: 'IBO01', serialCode: 'IBO01', nameTh: 'inBo', nameEn: 'inBo', categoryId: 1, modelSize: '100Unit', defaultUnitId: 2 },
    // Medical Instruments (categoryId: 2)
    { sku: 'TLS01', serialCode: 'TLS01', nameTh: 'TESSLIFT SOFT', nameEn: 'TESSLIFT SOFT', categoryId: 2, modelSize: 'ไหมโครงตาข่าย 10 เส้น + เข็มปลายทู่ 10 เล่ม', defaultUnitId: 1 },
    { sku: 'TPR01', serialCode: 'TPR01', nameTh: 'TESS PREDERM', nameEn: 'TESS PREDERM', categoryId: 2, modelSize: 'ไหม PDO จำนวน 32 เส้น', defaultUnitId: 1 },
    // Cosmetic (categoryId: 3)
    { sku: 'BBN01', serialCode: 'BBN01', nameTh: 'BABI BAB 6TH NATURE', nameEn: 'BABI BAB 6TH NATURE', categoryId: 3, modelSize: '5ขวด', defaultUnitId: 1 },
    { sku: 'BNO01', serialCode: 'BNO01', nameTh: 'BABI NEO ONE', nameEn: 'BABI NEO ONE', categoryId: 3, modelSize: '5 ขวด', defaultUnitId: 1 },
    { sku: 'TSN01', serialCode: 'TSN01', nameTh: 'TENSONEZ', nameEn: 'TENSONEZ', categoryId: 3, modelSize: '5 ขวด', defaultUnitId: 1 },
    { sku: 'BSS01', serialCode: 'BSS01', nameTh: 'BELLADDICT SSDN', nameEn: 'BELLADDICT SSDN', categoryId: 3, modelSize: '5 ขวด', defaultUnitId: 1 },
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
    { name: 'GRN', prefix: `GRN-${year}-`, currentVal: BigInt(0) },
    { name: 'OUTBOUND', prefix: `OUT-${year}-`, currentVal: BigInt(0) },
    { name: 'PRE_GEN', prefix: `PG-${year}-`, currentVal: BigInt(0) },
    { name: 'BORROW', prefix: `BR-${year}-`, currentVal: BigInt(0) },
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
  console.log('   Marketing: marketing1 / marketing123')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
