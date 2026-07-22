/**
 * Demo data seeder for portfolio screenshots.
 *
 * Fills every module with realistic Thai data on top of the base seed
 * (`npm run db:reset` must run first — masters, users, clinics, counters).
 *
 * Usage: npx tsx --env-file=.env scripts/seed-demo.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import prisma from '../lib/prisma'
import {
  generateSerialNumber,
  generateGRNNumber,
  generateOutboundNumber,
  generatePreGenBatchNumber,
  generateBorrowNumber,
  generateClaimNumber,
} from '../lib/serial-generator'
import { createQRToken, hashToken } from '../lib/qr-token'

// ---------- deterministic PRNG (reproducible data across re-runs) ----------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260715)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

// ---------- date helpers ----------
const YEAR = 2026
const D = (month: number, day: number, hour = 10, minute = 0) =>
  new Date(YEAR, month - 1, day, hour, minute)
const addMonths = (d: Date, m: number) => {
  const copy = new Date(d)
  copy.setMonth(copy.getMonth() + m)
  return copy
}

// ---------- Thai data pools ----------
const CUSTOMER_NAMES = [
  'คุณพิมพ์ชนก วงศ์สวัสดิ์', 'คุณอรทัย บุญมี', 'คุณธนภัทร ศรีวิไล', 'คุณณัฐธิดา จันทร์เพ็ญ',
  'คุณกมลชนก พูลสวัสดิ์', 'คุณศุภกร เรืองศรี', 'คุณวรรณิดา แก้วกาญจน์', 'คุณจิราภรณ์ ทองดี',
  'คุณปวีณา สุขสันต์', 'คุณอนันดา ภักดีวงศ์', 'คุณมนัสนันท์ ชูเกียรติ', 'คุณสุพิชญา อินทร์แก้ว',
  'คุณรวิสรา นาคทอง', 'คุณชลธิชา บัวแก้ว', 'คุณพัชราภา สิงห์โต', 'คุณกันตพงศ์ วัฒนกุล',
  'คุณเบญจวรรณ ศรีสุข', 'คุณฐิติมา รัตนโชติ', 'คุณนภัสสร คงคาใส', 'คุณอัญชลี พงษ์พันธ์',
  'คุณดวงกมล ใจงาม', 'คุณภัทรพล เลิศวิริยะ', 'คุณสิริกัญญา มั่นคง', 'คุณวิภาวี แสงทอง',
]
const PROVINCES = ['กรุงเทพมหานคร', 'ภูเก็ต', 'เชียงใหม่', 'ขอนแก่น', 'ชลบุรี', 'นครราชสีมา', 'เชียงราย', 'สงขลา']
const INCOMES = ['ต่ำกว่า 15,000', '15,000 - 30,000', '30,001 - 50,000', 'มากกว่า 50,000']
const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'เพื่อนแนะนำ', 'แพทย์/คลินิกแนะนำ', 'Google']
const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Line/14.5.0',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
]
const fakeIpHash = () =>
  createHash('sha256').update(`171.99.${randInt(1, 254)}.${randInt(1, 254)}`).digest('hex')
const fakePhone = () => `08${randInt(1, 9)}-${randInt(100, 999)}-${randInt(1000, 9999)}`

// ---------- shared state ----------
type Master = {
  id: number; sku: string; serialCode: string; nameTh: string; categoryId: number
  modelSize: string | null; defaultUnitId: number | null; activationType: 'SINGLE' | 'PACK'
  category: { serialCode: string }
}
type SeededItem = { id: number; serial12: number extends never ? never : string; sku: string; token: string; qrTokenId: number }
const tokenByItem = new Map<number, { qrTokenId: number; token: string }>()

async function createItem(
  master: Master,
  opts: { status: string; lot?: string; mfgDate?: Date; expDate?: Date; batchId?: number; createdAt: Date },
) {
  const serial12 = await generateSerialNumber({
    activationType: master.activationType,
    categorySerialCode: master.category.serialCode,
    serialCode: master.serialCode,
  })
  const item = await prisma.productItem.create({
    data: {
      serial12,
      sku: master.sku,
      name: master.nameTh,
      categoryId: master.categoryId,
      productMasterId: master.id,
      modelSize: master.modelSize,
      lot: opts.lot ?? null,
      mfgDate: opts.mfgDate ?? null,
      expDate: opts.expDate ?? null,
      status: opts.status as never,
      preGeneratedBatchId: opts.batchId ?? null,
      createdAt: opts.createdAt,
      updatedAt: opts.createdAt,
    },
  })
  const token = await createQRToken({
    serialNumber: serial12,
    productItemId: item.id,
    tokenVersion: 1,
    issuedAt: Math.floor(opts.createdAt.getTime() / 1000),
  })
  const qr = await prisma.qRToken.create({
    data: {
      productItemId: item.id,
      tokenVersion: 1,
      token,
      tokenHash: hashToken(token),
      status: 'ACTIVE',
      issuedAt: opts.createdAt,
    },
  })
  tokenByItem.set(item.id, { qrTokenId: qr.id, token })
  return { id: item.id, serial12, sku: master.sku, token, qrTokenId: qr.id }
}

async function log(eventType: string, opts: { itemId?: number; userId?: number; details?: Record<string, unknown>; at: Date }) {
  await prisma.eventLog.create({
    data: {
      eventType,
      productItemId: opts.itemId ?? null,
      userId: opts.userId ?? null,
      details: (opts.details ?? undefined) as never,
      createdAt: opts.at,
    },
  })
}

async function scan(itemId: number, result: string, at: Date, tokenVersion = 1, qrTokenId?: number | null) {
  await prisma.scanLog.create({
    data: {
      productItemId: itemId,
      qrTokenId: qrTokenId === undefined ? tokenByItem.get(itemId)?.qrTokenId ?? null : qrTokenId,
      tokenVersion,
      result,
      ipHash: fakeIpHash(),
      userAgent: pick(USER_AGENTS),
      scannedAt: at,
    },
  })
}

async function main() {
  console.log('🌱 Seeding demo data...')

  // ---------- preflight ----------
  if (!process.env.QR_TOKEN_SECRET) throw new Error('QR_TOKEN_SECRET is not set — run with --env-file=.env')
  const masterCount = await prisma.productMaster.count()
  if (masterCount !== 7) throw new Error(`Expected 7 product masters, found ${masterCount} — run "npm run db:reset" first`)
  const existingItems = await prisma.productItem.count()
  if (existingItems > 0) throw new Error(`Found ${existingItems} product items — DB is not clean, run "npm run db:reset" first`)

  const masters = (await prisma.productMaster.findMany({ include: { category: true } })) as unknown as Master[]
  const M = Object.fromEntries(masters.map((m) => [m.sku, m])) as Record<string, Master>
  const unitOf = (m: Master) => m.defaultUnitId ?? 1

  const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } })
  const warehouse1 = await prisma.user.findUniqueOrThrow({ where: { username: 'warehouse1' } })
  const manager1 = await prisma.user.findUniqueOrThrow({ where: { username: 'manager1' } })

  // ---------- Section 0: master touch-ups ----------
  await prisma.user.update({ where: { id: admin.id }, data: { forcePwChange: false } })

  const productImages: Record<string, string> = {
    BBN01: '/uploads/products/1769936068938-qn66o.png',
    BNO01: '/uploads/products/1769936891272-qq9oi36.png',
    TSN01: '/uploads/products/1770024943424-n1xa64.png',
    TLS01: '/uploads/products/1771484366028-4c8que.png',
  }
  const productDescriptions: Record<string, string> = {
    BBN01: 'เซรั่มบำรุงผิวหน้าสูตรธรรมชาติ ช่วยฟื้นฟูผิวให้กระจ่างใส',
    BNO01: 'ผลิตภัณฑ์บำรุงผิวสูตรเข้มข้น สำหรับผิวที่ต้องการการดูแลพิเศษ',
    TSN01: 'ผลิตภัณฑ์กระชับผิวหน้า ลดเลือนริ้วรอย',
    TLS01: 'ไหมยกกระชับโครงตาข่าย พร้อมเข็มปลายทู่สำหรับหัตถการ',
  }
  for (const [sku, imageUrl] of Object.entries(productImages)) {
    await prisma.productMaster.update({ where: { sku }, data: { imageUrl, description: productDescriptions[sku] } })
  }

  const clinic4 = await prisma.clinic.create({
    data: {
      name: 'คลินิกความงามวรารมย์', address: 'ขอนแก่น', branchName: 'สาขาถนนมิตรภาพ',
      companyName: 'บริษัท วรารมย์ เวลเนส จำกัด', invoiceName: 'บริษัท วรารมย์ เวลเนส จำกัด (สำนักงานใหญ่)',
      contactName: 'คุณวราภรณ์ ศรีสุข', contactPhone: '081-234-5678',
      createdAt: D(1, 15), updatedAt: D(1, 15),
    },
  })
  const clinic5 = await prisma.clinic.create({
    data: {
      name: 'เดอร์มาคลินิก', address: 'ชลบุรี', branchName: 'สาขาพัทยา',
      contactName: 'คุณนิรมล จันทร์แจ่ม', contactPhone: '086-555-1234',
      createdAt: D(2, 1), updatedAt: D(2, 1),
    },
  })
  const clinic6 = await prisma.clinic.create({
    data: {
      name: 'สยามสกินแคร์คลินิก', address: 'นครราชสีมา', branchName: null,
      companyName: 'หจก. สยามสกินแคร์', contactName: 'คุณประเสริฐ วงศ์เจริญ', contactPhone: '089-777-8899',
      createdAt: D(3, 5), updatedAt: D(3, 5),
    },
  })
  // enrich base clinics so the detail page looks complete
  await prisma.clinic.update({ where: { id: 1 }, data: { companyName: 'บริษัท เอบีซี เมดิคอล กรุ๊ป จำกัด', invoiceName: 'บริษัท เอบีซี เมดิคอล กรุ๊ป จำกัด (สาขาสยาม)', contactName: 'คุณสุนิสา แก้วใส', contactPhone: '02-111-2233' } })
  await prisma.clinic.update({ where: { id: 2 }, data: { contactName: 'คุณอารยา บุญรอด', contactPhone: '076-333-444' } })
  await prisma.clinic.update({ where: { id: 3 }, data: { companyName: 'บริษัท สกินแคร์พลัส จำกัด', contactName: 'คุณกฤษณะ ใจเย็น', contactPhone: '053-222-999' } })
  console.log('✅ Section 0: masters + clinics enriched, admin forcePwChange cleared')

  // ---------- Section 1: GRNs ----------
  type GrnItemPlan = { master: Master; qty: number; lot: string; mfg: Date; sessionIdx?: number }
  async function createGRN(cfg: {
    receivedAt: Date; warehouseId: number; supplier: string; supplierAddress: string
    supplierPhone: string; supplierContact: string; poNo: string; deliveryNoteNo: string
    approved?: { by: number; at: Date }; receivingStatus: 'PARTIAL' | 'COMPLETE'
    plans: { master: Master; totalQty: number; receivedQty: number; lot: string; mfg: Date }[]
    receiving: GrnItemPlan[]
    sessions: { sessionNo: number; receivedAt: Date; itemCount: number; remarks?: string }[]
    remarks?: string
  }) {
    const grnNo = await generateGRNNumber()
    const header = await prisma.gRNHeader.create({
      data: {
        grnNo, receivedAt: cfg.receivedAt, receivedById: warehouse1.id, warehouseId: cfg.warehouseId,
        poNo: cfg.poNo, supplierName: cfg.supplier, deliveryNoteNo: cfg.deliveryNoteNo,
        supplierAddress: cfg.supplierAddress, supplierPhone: cfg.supplierPhone, supplierContact: cfg.supplierContact,
        deliveryDocDate: cfg.receivedAt,
        approvedById: cfg.approved?.by ?? null, approvedAt: cfg.approved?.at ?? null,
        receivingStatus: cfg.receivingStatus, remarks: cfg.remarks ?? null,
        createdAt: cfg.receivedAt, updatedAt: cfg.approved?.at ?? cfg.receivedAt,
      },
    })
    for (const p of cfg.plans) {
      await prisma.gRNPlanLine.create({
        data: {
          grnHeaderId: header.id, productMasterId: p.master.id, totalQty: p.totalQty, receivedQty: p.receivedQty,
          unitId: unitOf(p.master), lot: p.lot, mfgDate: p.mfg, expDate: addMonths(p.mfg, 24),
          createdAt: cfg.receivedAt, updatedAt: cfg.receivedAt,
        },
      })
    }
    const sessionIds: number[] = []
    for (const s of cfg.sessions) {
      const session = await prisma.gRNReceivingSession.create({
        data: {
          grnHeaderId: header.id, sessionNo: s.sessionNo, receivedById: warehouse1.id,
          receivedAt: s.receivedAt, itemCount: s.itemCount, remarks: s.remarks ?? null, createdAt: s.receivedAt,
        },
      })
      sessionIds.push(session.id)
    }
    const items: Awaited<ReturnType<typeof createItem>>[] = []
    for (const r of cfg.receiving) {
      const sessionIdx = r.sessionIdx ?? 0
      const at = cfg.sessions[sessionIdx].receivedAt
      for (let i = 0; i < r.qty; i++) {
        const item = await createItem(r.master, {
          status: 'IN_STOCK', lot: r.lot, mfgDate: r.mfg, expDate: addMonths(r.mfg, 24), createdAt: at,
        })
        await prisma.gRNLine.create({
          data: {
            grnHeaderId: header.id, productItemId: item.id, sku: r.master.sku, itemName: r.master.nameTh,
            modelSize: r.master.modelSize, quantity: 1, unitId: unitOf(r.master), lot: r.lot,
            mfgDate: r.mfg, expDate: addMonths(r.mfg, 24), receivingSessionId: sessionIds[sessionIdx], createdAt: at,
          },
        })
        await log('INBOUND', { itemId: item.id, userId: warehouse1.id, details: { grnNumber: grnNo, serialNumber: item.serial12 }, at })
        items.push(item)
      }
    }
    return { header, items, grnNo }
  }

  const grn1 = await createGRN({
    receivedAt: D(2, 10, 9, 30), warehouseId: 1,
    supplier: 'บริษัท เมดิคอล ซัพพลาย (ประเทศไทย) จำกัด',
    supplierAddress: '88/12 ถนนพระราม 4 แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
    supplierPhone: '02-666-7788', supplierContact: 'คุณสมศักดิ์ รุ่งเรือง',
    poNo: 'SUP-PO-6902-014', deliveryNoteNo: 'DN-680210-05',
    approved: { by: manager1.id, at: D(2, 11, 14, 0) }, receivingStatus: 'COMPLETE',
    plans: [
      { master: M.IBO01, totalQty: 15, receivedQty: 15, lot: 'IBO-LOT-6811', mfg: D(1, 5) },
      { master: M.TLS01, totalQty: 12, receivedQty: 12, lot: 'TLS-LOT-6812', mfg: D(1, 8) },
      { master: M.BBN01, totalQty: 18, receivedQty: 18, lot: 'BBN-LOT-6811', mfg: D(1, 12) },
    ],
    receiving: [
      { master: M.IBO01, qty: 15, lot: 'IBO-LOT-6811', mfg: D(1, 5) },
      { master: M.TLS01, qty: 12, lot: 'TLS-LOT-6812', mfg: D(1, 8) },
      { master: M.BBN01, qty: 18, lot: 'BBN-LOT-6811', mfg: D(1, 12) },
    ],
    sessions: [{ sessionNo: 1, receivedAt: D(2, 10, 9, 30), itemCount: 45 }],
  })
  const grn2 = await createGRN({
    receivedAt: D(4, 20, 10, 15), warehouseId: 1,
    supplier: 'บริษัท บิวตี้ อินโนเวชัน จำกัด',
    supplierAddress: '199 อาคารสีลมทาวเวอร์ ชั้น 12 ถนนสีลม เขตบางรัก กรุงเทพมหานคร 10500',
    supplierPhone: '02-234-5566', supplierContact: 'คุณอรอนงค์ พิทักษ์',
    poNo: 'SUP-PO-6904-031', deliveryNoteNo: 'DN-680420-11',
    approved: { by: manager1.id, at: D(4, 21, 11, 30) }, receivingStatus: 'COMPLETE',
    plans: [
      { master: M.TPR01, totalQty: 12, receivedQty: 12, lot: 'TPR-LOT-6903', mfg: D(3, 2) },
      { master: M.BNO01, totalQty: 14, receivedQty: 14, lot: 'BNO-LOT-6903', mfg: D(3, 10) },
      { master: M.TSN01, totalQty: 14, receivedQty: 14, lot: 'TSN-LOT-6903', mfg: D(3, 15) },
    ],
    receiving: [
      { master: M.TPR01, qty: 12, lot: 'TPR-LOT-6903', mfg: D(3, 2) },
      { master: M.BNO01, qty: 14, lot: 'BNO-LOT-6903', mfg: D(3, 10) },
      { master: M.TSN01, qty: 14, lot: 'TSN-LOT-6903', mfg: D(3, 15) },
    ],
    sessions: [{ sessionNo: 1, receivedAt: D(4, 20, 10, 15), itemCount: 40 }],
  })
  const grn3 = await createGRN({
    receivedAt: D(7, 8, 9, 0), warehouseId: 2,
    supplier: 'บริษัท เอเชีย คอสเมด จำกัด',
    supplierAddress: '45/9 นิคมอุตสาหกรรมอมตะซิตี้ ตำบลดอนหัวฬ่อ อำเภอเมือง ชลบุรี 20000',
    supplierPhone: '038-456-789', supplierContact: 'คุณพงศ์พัฒน์ เจริญสุข',
    poNo: 'SUP-PO-6907-002', deliveryNoteNo: 'DN-680708-03',
    receivingStatus: 'PARTIAL',
    remarks: 'สินค้า TENSONEZ ยังไม่มาส่ง รอรับเพิ่มในรอบถัดไป',
    plans: [
      { master: M.BSS01, totalQty: 20, receivedQty: 12, lot: 'BSS-LOT-6906', mfg: D(6, 1) },
      { master: M.TSN01, totalQty: 10, receivedQty: 0, lot: 'TSN-LOT-6906', mfg: D(6, 5) },
    ],
    receiving: [
      { master: M.BSS01, qty: 8, lot: 'BSS-LOT-6906', mfg: D(6, 1), sessionIdx: 0 },
      { master: M.BSS01, qty: 4, lot: 'BSS-LOT-6906', mfg: D(6, 1), sessionIdx: 1 },
    ],
    sessions: [
      { sessionNo: 1, receivedAt: D(7, 8, 9, 0), itemCount: 8 },
      { sessionNo: 2, receivedAt: D(7, 13, 14, 30), itemCount: 4, remarks: 'รับเพิ่มรอบสอง' },
    ],
  })
  console.log(`✅ Section 1: GRNs ${grn1.grnNo}, ${grn2.grnNo}, ${grn3.grnNo} (${grn1.items.length + grn2.items.length + grn3.items.length} items)`)

  // ---------- Section 2: pre-generated batch ----------
  const batchNo = await generatePreGenBatchNumber()
  const batch = await prisma.preGeneratedBatch.create({
    data: {
      batchNo, quantity: 20, productMasterId: M.BBN01.id, createdById: warehouse1.id,
      remarks: 'เตรียม QR ล่วงหน้าสำหรับล็อตการผลิตเดือนกรกฎาคม',
      linkedCount: 8, printCount: 2, lastPrintedAt: D(7, 2, 15, 0), createdAt: D(6, 25, 10, 0),
    },
  })
  const preGenItems: Awaited<ReturnType<typeof createItem>>[] = []
  for (let i = 0; i < 20; i++) {
    const item = await createItem(M.BBN01, { status: 'PENDING_LINK', batchId: batch.id, createdAt: D(6, 25, 10, 5) })
    await log('PRE_GENERATE', { itemId: item.id, userId: warehouse1.id, details: { batchNo, serialNumber: item.serial12 }, at: D(6, 25, 10, 5) })
    preGenItems.push(item)
  }
  const linkedPreGen = preGenItems.slice(0, 8)
  for (const item of linkedPreGen) {
    await prisma.productItem.update({
      where: { id: item.id },
      data: { status: 'IN_STOCK', lot: 'BBN-LOT-6906', mfgDate: D(6, 20), expDate: addMonths(D(6, 20), 24), updatedAt: D(7, 1, 11, 0) },
    })
    await log('INBOUND', { itemId: item.id, userId: warehouse1.id, details: { batchNo, serialNumber: item.serial12, linked: true }, at: D(7, 1, 11, 0) })
  }
  await prisma.preGeneratedBatchPrintLog.create({ data: { batchId: batch.id, userId: warehouse1.id, layout: 'grid', createdAt: D(6, 25, 10, 30) } })
  await prisma.preGeneratedBatchPrintLog.create({ data: { batchId: batch.id, userId: warehouse1.id, layout: 'individual', isReprint: true, reason: 'ฉลากชุดแรกพิมพ์ไม่ชัด หมึกจาง', createdAt: D(7, 2, 15, 0) } })
  console.log(`✅ Section 2: pre-gen batch ${batchNo} (20 QR, linked 8)`)

  // ---------- Section 3: purchase orders ----------
  async function nextPoNo(): Promise<string> {
    const counter = await prisma.sequenceCounter.upsert({
      where: { name: 'PO' },
      update: { currentVal: { increment: 1 } },
      create: { name: 'PO', prefix: `PO-${YEAR}-`, currentVal: 1 },
    })
    return `PO-${YEAR}-${String(counter.currentVal).padStart(6, '0')}`
  }
  async function createPO(cfg: {
    clinicId: number; status: string; at: Date; remarks?: string
    lines: { master: Master; qty: number; shipped: number }[]
    clinicContactName?: string; clinicAddress?: string; clinicPhone?: string; billingName?: string
  }) {
    const poNo = await nextPoNo()
    return prisma.purchaseOrder.create({
      data: {
        poNo, clinicId: cfg.clinicId, status: cfg.status as never, remarks: cfg.remarks ?? null,
        salesPersonName: 'คุณสมชาย ใจดี', companyContact: 'Line: @edencolors / 02-999-8877',
        clinicContactName: cfg.clinicContactName ?? null, clinicAddress: cfg.clinicAddress ?? null,
        clinicPhone: cfg.clinicPhone ?? null, billingName: cfg.billingName ?? null,
        createdById: admin.id, createdAt: cfg.at, updatedAt: cfg.at,
        lines: { create: cfg.lines.map((l) => ({ productMasterId: l.master.id, quantity: l.qty, shippedQuantity: l.shipped, createdAt: cfg.at })) },
      },
    })
  }
  const po1 = await createPO({
    clinicId: 1, status: 'COMPLETED', at: D(2, 5, 13, 0),
    clinicContactName: 'คุณสุนิสา แก้วใส', clinicAddress: '991 สยามพารากอน ถนนพระราม 1 เขตปทุมวัน กรุงเทพมหานคร', clinicPhone: '02-111-2233',
    billingName: 'บริษัท เอบีซี เมดิคอล กรุ๊ป จำกัด',
    lines: [{ master: M.IBO01, qty: 8, shipped: 8 }, { master: M.BBN01, qty: 7, shipped: 7 }],
  })
  const po2 = await createPO({
    clinicId: 3, status: 'PARTIAL', at: D(5, 2, 10, 30),
    clinicContactName: 'คุณกฤษณะ ใจเย็น', clinicAddress: 'ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมือง เชียงใหม่', clinicPhone: '053-222-999',
    billingName: 'บริษัท สกินแคร์พลัส จำกัด',
    lines: [{ master: M.TPR01, qty: 8, shipped: 6 }, { master: M.TSN01, qty: 8, shipped: 6 }],
  })
  const po3 = await createPO({
    clinicId: clinic4.id, status: 'CONFIRMED', at: D(7, 10, 9, 45),
    clinicContactName: 'คุณวราภรณ์ ศรีสุข', clinicAddress: 'ถนนมิตรภาพ อำเภอเมือง ขอนแก่น', clinicPhone: '081-234-5678',
    lines: [{ master: M.BNO01, qty: 10, shipped: 0 }, { master: M.BSS01, qty: 6, shipped: 0 }],
  })
  const po4 = await createPO({
    clinicId: 2, status: 'DRAFT', at: D(7, 14, 16, 20),
    lines: [{ master: M.TLS01, qty: 5, shipped: 0 }],
  })
  const po5 = await createPO({
    clinicId: clinic5.id, status: 'CANCELLED', at: D(6, 1, 11, 0), remarks: 'ลูกค้าขอยกเลิกคำสั่งซื้อ เนื่องจากเปลี่ยนแผนการสั่งสินค้า',
    lines: [{ master: M.IBO01, qty: 12, shipped: 0 }],
  })
  console.log(`✅ Section 3: POs ${po1.poNo} … ${po5.poNo}`)

  // ---------- Section 4: outbounds ----------
  const clinicById = new Map(
    (await prisma.clinic.findMany()).map((c) => [c.id, c]),
  )
  async function createOutbound(cfg: {
    at: Date; clinicId: number; warehouseId: number; shippingMethodId: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DRAFT'
    approvedAt?: Date; shippedAt?: Date; rejectReason?: string; purchaseOrderId?: number
    items: Awaited<ReturnType<typeof createItem>>[]
    itemStatusAfter: 'PENDING_OUT' | 'SHIPPED' | 'IN_STOCK'
    remarks?: string
  }) {
    const deliveryNoteNo = await generateOutboundNumber()
    const clinic = clinicById.get(cfg.clinicId)!
    const header = await prisma.outboundHeader.create({
      data: {
        deliveryNoteNo, createdById: warehouse1.id, warehouseId: cfg.warehouseId,
        shippingMethodId: cfg.shippingMethodId, clinicId: cfg.clinicId,
        clinicAddress: clinic.address, clinicPhone: clinic.contactPhone, clinicContactName: clinic.contactName,
        salesPersonName: 'คุณสมชาย ใจดี', companyContact: 'Line: @edencolors / 02-999-8877',
        purchaseOrderId: cfg.purchaseOrderId ?? null,
        status: cfg.status as never,
        approvedById: cfg.status === 'APPROVED' || cfg.status === 'REJECTED' ? manager1.id : null,
        approvedAt: cfg.approvedAt ?? null, shippedAt: cfg.shippedAt ?? null,
        rejectReason: cfg.rejectReason ?? null, remarks: cfg.remarks ?? null,
        createdAt: cfg.at, updatedAt: cfg.approvedAt ?? cfg.at,
      },
    })
    const itemsBySku = new Map<string, number>()
    for (const item of cfg.items) {
      const full = await prisma.productItem.findUniqueOrThrow({ where: { id: item.id } })
      await prisma.outboundLine.create({
        data: {
          outboundId: header.id, productItemId: item.id, sku: full.sku, itemName: full.name,
          modelSize: full.modelSize, quantity: 1, unitId: unitOf(M[full.sku]), lot: full.lot,
          expDate: full.expDate, itemStatus: 'สภาพปกติ', createdAt: cfg.at,
        },
      })
      const assign = cfg.itemStatusAfter === 'IN_STOCK' ? null : cfg.clinicId
      await prisma.productItem.update({
        where: { id: item.id },
        data: { status: cfg.itemStatusAfter as never, assignedClinicId: assign, updatedAt: cfg.approvedAt ?? cfg.at },
      })
      await log('OUTBOUND', { itemId: item.id, userId: warehouse1.id, details: { outboundNumber: deliveryNoteNo, clinicName: clinic.name, serialNumber: full.serial12 }, at: cfg.at })
      itemsBySku.set(full.sku, (itemsBySku.get(full.sku) ?? 0) + 1)
    }
    if (cfg.status === 'APPROVED') {
      await log('APPROVE', { userId: manager1.id, details: { outboundNumber: deliveryNoteNo, clinicName: clinic.name }, at: cfg.approvedAt! })
    } else if (cfg.status === 'REJECTED') {
      await log('REJECT', { userId: manager1.id, details: { outboundNumber: deliveryNoteNo, clinicName: clinic.name, reason: cfg.rejectReason }, at: cfg.approvedAt ?? cfg.at })
    }
    return { header, deliveryNoteNo }
  }

  // slice item pools per plan ledger
  const ibo = grn1.items.filter((i) => i.sku === 'IBO01') // 15
  const tls = grn1.items.filter((i) => i.sku === 'TLS01') // 12
  const bbn = grn1.items.filter((i) => i.sku === 'BBN01') // 18
  const tpr = grn2.items.filter((i) => i.sku === 'TPR01') // 12
  const bno = grn2.items.filter((i) => i.sku === 'BNO01') // 14
  const tsn = grn2.items.filter((i) => i.sku === 'TSN01') // 14
  const bss = grn3.items // 12 BSS01

  const out1 = await createOutbound({
    at: D(2, 18, 10, 0), clinicId: 1, warehouseId: 1, shippingMethodId: 3, status: 'APPROVED',
    approvedAt: D(2, 19, 9, 30), shippedAt: D(2, 20, 8, 0), purchaseOrderId: po1.id,
    items: [...ibo.slice(0, 8), ...bbn.slice(0, 7)], itemStatusAfter: 'SHIPPED',
  })
  const out2 = await createOutbound({
    at: D(3, 12, 11, 0), clinicId: 2, warehouseId: 1, shippingMethodId: 1, status: 'APPROVED',
    approvedAt: D(3, 13, 10, 0), shippedAt: D(3, 13, 15, 0),
    items: [...tls.slice(0, 6), ...bbn.slice(7, 13)], itemStatusAfter: 'SHIPPED',
  })
  const out3 = await createOutbound({
    at: D(5, 6, 9, 30), clinicId: 3, warehouseId: 1, shippingMethodId: 2, status: 'APPROVED',
    approvedAt: D(5, 7, 13, 0), shippedAt: D(5, 8, 9, 0), purchaseOrderId: po2.id,
    items: [...tpr.slice(0, 6), ...tsn.slice(0, 6)], itemStatusAfter: 'SHIPPED',
  })
  const out4 = await createOutbound({
    at: D(6, 10, 14, 0), clinicId: clinic4.id, warehouseId: 1, shippingMethodId: 5, status: 'APPROVED',
    approvedAt: D(6, 11, 9, 0), shippedAt: D(6, 11, 16, 30),
    items: [...bno.slice(0, 5), ...tsn.slice(6, 11)], itemStatusAfter: 'SHIPPED',
  })
  const out5 = await createOutbound({
    at: D(6, 24, 10, 30), clinicId: clinic5.id, warehouseId: 1, shippingMethodId: 4, status: 'REJECTED',
    approvedAt: D(6, 25, 11, 0), rejectReason: 'ที่อยู่จัดส่งไม่ครบถ้วน กรุณาแก้ไขข้อมูลคลินิกก่อนส่งอนุมัติใหม่',
    items: tpr.slice(6, 10), itemStatusAfter: 'IN_STOCK',
  })
  const out6 = await createOutbound({
    at: D(7, 13, 15, 30), clinicId: 2, warehouseId: 1, shippingMethodId: 1, status: 'PENDING',
    items: [...bno.slice(5, 8), ...ibo.slice(8, 11)], itemStatusAfter: 'PENDING_OUT',
  })
  const out7 = await createOutbound({
    at: D(7, 14, 10, 45), clinicId: clinic6.id, warehouseId: 2, shippingMethodId: 6, status: 'PENDING',
    items: bss.slice(0, 5), itemStatusAfter: 'PENDING_OUT',
  })
  const out8 = await createOutbound({
    at: D(7, 15, 9, 15), clinicId: 1, warehouseId: 1, shippingMethodId: 1, status: 'DRAFT',
    items: tls.slice(6, 9), itemStatusAfter: 'PENDING_OUT',
    remarks: 'ร่างใบส่งออก รอยืนยันจำนวนจากฝ่ายขาย',
  })
  console.log(`✅ Section 4: outbounds ${out1.deliveryNoteNo} … ${out8.deliveryNoteNo}`)

  // ---------- Section 5: activations ----------
  const shippedGroups: { items: Awaited<ReturnType<typeof createItem>>[]; clinicId: number; from: Date; to: Date; count: number }[] = [
    { items: [...ibo.slice(0, 8), ...bbn.slice(0, 7)], clinicId: 1, from: D(2, 22), to: D(4, 15), count: 13 },
    { items: [...tls.slice(0, 6), ...bbn.slice(7, 13)], clinicId: 2, from: D(3, 15), to: D(5, 20), count: 10 },
    { items: [...tpr.slice(0, 6), ...tsn.slice(0, 6)], clinicId: 3, from: D(5, 10), to: D(6, 25), count: 9 },
    { items: [...bno.slice(0, 5), ...tsn.slice(6, 11)], clinicId: clinic4.id, from: D(6, 15), to: D(7, 14), count: 5 },
  ]
  const activatedItems: { id: number; serial12: string; clinicId: number }[] = []
  let activationTotal = 0
  for (const group of shippedGroups) {
    const clinic = clinicById.get(group.clinicId)!
    const span = group.to.getTime() - group.from.getTime()
    for (let i = 0; i < group.count; i++) {
      const item = group.items[i]
      const at = new Date(group.from.getTime() + (span * (i + rand() * 0.8)) / group.count)
      const filled = rand() < 0.8
      await prisma.activation.create({
        data: {
          productItemId: item.id, activationNumber: 1,
          customerName: filled ? pick(CUSTOMER_NAMES) : null,
          age: filled ? randInt(19, 65) : null,
          gender: filled ? (rand() < 0.6 ? 'F' : rand() < 0.9 ? 'M' : 'Prefer not to say') : null,
          province: rand() < 0.7 ? clinic.address : pick(PROVINCES),
          phone: filled ? fakePhone() : null,
          income: filled ? pick(INCOMES) : null,
          discoveryChannel: filled ? pick(CHANNELS) : null,
          consentAt: at, policyVersion: '1.0', createdAt: at,
        },
      })
      await prisma.productItem.update({ where: { id: item.id }, data: { status: 'ACTIVATED', activationCount: 1, updatedAt: at } })
      await scan(item.id, 'ACTIVATED', at)
      await log('ACTIVATE', { itemId: item.id, details: { serialNumber: item.serial12, clinicName: clinic.name }, at })
      activatedItems.push({ id: item.id, serial12: item.serial12, clinicId: group.clinicId })
      activationTotal++
    }
  }
  // make sure one activation lands today (dashboard/analytics freshness)
  const today = new Date()
  const lastActivated = activatedItems[activatedItems.length - 1]
  const todayMorning = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 40)
  await prisma.activation.updateMany({ where: { productItemId: lastActivated.id }, data: { consentAt: todayMorning, createdAt: todayMorning } })
  await prisma.productItem.update({ where: { id: lastActivated.id }, data: { updatedAt: todayMorning } })
  console.log(`✅ Section 5: ${activationTotal} activations`)

  // ---------- Section 6: returns ----------
  // pick actual current SHIPPED / ACTIVATED items from DB to be safe
  const shippedNow = await prisma.productItem.findMany({ where: { status: 'SHIPPED' }, orderBy: { id: 'asc' } })
  const activatedNow = await prisma.productItem.findMany({ where: { status: 'ACTIVATED' }, orderBy: { id: 'asc' } })
  const ret1 = shippedNow[0]
  const ret2 = activatedNow.find((i) => i.assignedClinicId === 3)!
  for (const [item, at, reason] of [
    [ret1, D(5, 28, 11, 0), 'คลินิกส่งคืน สินค้าเกินจากยอดที่ใช้จริง'],
    [ret2, D(7, 3, 14, 20), 'ลูกค้าแพ้ผลิตภัณฑ์ ขอคืนสินค้า'],
  ] as const) {
    await prisma.productItem.update({ where: { id: item.id }, data: { status: 'RETURNED', updatedAt: at } })
    await scan(item.id, 'RETURNED', at)
    await log('RETURN', { itemId: item.id, userId: warehouse1.id, details: { serialNumber: item.serial12, reason }, at })
  }
  console.log('✅ Section 6: 2 returns')

  // ---------- Section 7: reprint ----------
  const shippedForReprint = (await prisma.productItem.findMany({ where: { status: 'SHIPPED', assignedClinicId: 2 }, take: 1 }))[0]
  const oldToken = tokenByItem.get(shippedForReprint.id)!
  const reprintAt = D(6, 30, 13, 45)
  await prisma.qRToken.update({
    where: { id: oldToken.qrTokenId },
    data: { status: 'REVOKED', revokedAt: reprintAt, revokeReason: 'ฉลากเดิมชำรุด อ่านไม่ได้' },
  })
  const newToken = await createQRToken({
    serialNumber: shippedForReprint.serial12, productItemId: shippedForReprint.id,
    tokenVersion: 2, issuedAt: Math.floor(reprintAt.getTime() / 1000),
  })
  const newQr = await prisma.qRToken.create({
    data: { productItemId: shippedForReprint.id, tokenVersion: 2, token: newToken, tokenHash: hashToken(newToken), status: 'ACTIVE', issuedAt: reprintAt },
  })
  tokenByItem.set(shippedForReprint.id, { qrTokenId: newQr.id, token: newToken })
  await log('REPRINT', { itemId: shippedForReprint.id, userId: warehouse1.id, details: { serialNumber: shippedForReprint.serial12, previousVersion: 1, newVersion: 2, reason: 'ฉลากเดิมชำรุด อ่านไม่ได้' }, at: reprintAt })
  await scan(shippedForReprint.id, 'REVOKED', D(7, 1, 10, 20), 1, oldToken.qrTokenId)
  await scan(shippedForReprint.id, 'REPRINTED', D(7, 2, 16, 5), 1, oldToken.qrTokenId)
  console.log('✅ Section 7: reprint with token v2')

  // ---------- Section 8: borrows ----------
  async function createBorrow(cfg: {
    type: 'BORROW' | 'RETURN'; status: string; at: Date; borrowerName: string
    clinicName?: string; clinicAddress?: string; contactName?: string; contactPhone?: string
    reason?: string; approvedAt?: Date
    items: { id: number }[]
    itemStatusAfter?: 'BORROWED' | 'IN_STOCK' | null
    eventType?: 'BORROW' | 'BORROW_RETURN'
  }) {
    const transactionNo = await generateBorrowNumber()
    const header = await prisma.borrowTransaction.create({
      data: {
        transactionNo, type: cfg.type, status: cfg.status as never, borrowerName: cfg.borrowerName,
        clinicName: cfg.clinicName ?? null, clinicAddress: cfg.clinicAddress ?? null,
        contactName: cfg.contactName ?? null, contactPhone: cfg.contactPhone ?? null,
        reason: cfg.reason ?? null, createdById: warehouse1.id,
        approvedById: cfg.approvedAt ? manager1.id : null, approvedAt: cfg.approvedAt ?? null,
        createdAt: cfg.at, updatedAt: cfg.approvedAt ?? cfg.at,
      },
    })
    for (const ref of cfg.items) {
      const full = await prisma.productItem.findUniqueOrThrow({ where: { id: ref.id } })
      await prisma.borrowTransactionLine.create({
        data: {
          borrowTransactionId: header.id, productItemId: full.id, sku: full.sku, itemName: full.name,
          modelSize: full.modelSize, quantity: 1, unitId: unitOf(M[full.sku]), lot: full.lot,
          expDate: full.expDate, createdAt: cfg.at,
        },
      })
      if (cfg.itemStatusAfter) {
        await prisma.productItem.update({ where: { id: full.id }, data: { status: cfg.itemStatusAfter as never, updatedAt: cfg.approvedAt ?? cfg.at } })
      }
      await log(cfg.eventType ?? 'BORROW', { itemId: full.id, userId: warehouse1.id, details: { transactionNo, serialNumber: full.serial12, borrowerName: cfg.borrowerName }, at: cfg.at })
    }
    return { header, transactionNo }
  }

  const br1 = await createBorrow({
    type: 'BORROW', status: 'APPROVED', at: D(5, 15, 10, 0), approvedAt: D(5, 16, 9, 30),
    borrowerName: 'คุณนภัสวรรณ อารีย์ (ฝ่ายขาย)', clinicName: 'เดอร์มาคลินิก', clinicAddress: 'ชลบุรี สาขาพัทยา',
    contactName: 'คุณนิรมล จันทร์แจ่ม', contactPhone: '086-555-1234',
    reason: 'ยืมไปสาธิตสินค้าให้คลินิกลูกค้าใหม่',
    items: [...tls.slice(9, 11), ...bno.slice(8, 11)], itemStatusAfter: 'BORROWED',
  })
  const br2 = await createBorrow({
    type: 'BORROW', status: 'PENDING', at: D(7, 14, 13, 20),
    borrowerName: 'คุณกิตติศักดิ์ พรหมมา (การตลาด)', clinicName: 'สยามสกินแคร์คลินิก', clinicAddress: 'นครราชสีมา',
    reason: 'ยืมสำหรับออกบูธงานแสดงสินค้าความงาม',
    items: linkedPreGen.slice(0, 3), itemStatusAfter: null,
  })
  const br3Items = ibo.slice(11, 14)
  const br3 = await createBorrow({
    type: 'BORROW', status: 'RETURNED', at: D(4, 2, 9, 0), approvedAt: D(4, 3, 10, 15),
    borrowerName: 'คุณอมรรัตน์ สุวรรณี (ฝ่ายขาย)', clinicName: 'ABC Clinic', clinicAddress: 'กรุงเทพมหานคร สาขาสยาม',
    reason: 'ยืมไปทดลองใช้ที่คลินิก', items: br3Items, itemStatusAfter: null,
  })
  const br4 = await createBorrow({
    type: 'RETURN', status: 'APPROVED', at: D(4, 28, 15, 40), approvedAt: D(4, 28, 15, 40),
    borrowerName: 'คุณอมรรัตน์ สุวรรณี (ฝ่ายขาย)', clinicName: 'ABC Clinic',
    reason: `คืนสินค้าจากการยืม ${br3.transactionNo}`, items: br3Items, itemStatusAfter: 'IN_STOCK',
    eventType: 'BORROW_RETURN',
  })
  console.log(`✅ Section 8: borrows ${br1.transactionNo} … ${br4.transactionNo}`)

  // ---------- Section 9: damaged + action requests ----------
  const damagedItems = [
    { item: bbn[13], at: D(5, 20, 11, 30), reason: 'บรรจุภัณฑ์แตกระหว่างจัดเก็บ' },
    { item: bbn[14], at: D(6, 8, 14, 0), reason: 'ฉลากสินค้าหลุดลอก ไม่สามารถระบุล็อตได้' },
    { item: tpr[10], at: D(6, 18, 10, 45), reason: 'ซองบรรจุฉีกขาด' },
    { item: tpr[11], at: D(7, 6, 9, 20), reason: 'สินค้าตกกระแทกระหว่างเคลื่อนย้าย' },
    { item: tsn[11], at: D(6, 5, 13, 10), reason: 'ขวดร้าว มีรอยรั่วซึม' },
    { item: bss[10], at: D(5, 25, 15, 30), reason: 'กล่องบุบเสียหายจากการขนส่ง' },
    { item: bss[11], at: D(5, 25, 15, 35), reason: 'กล่องบุบเสียหายจากการขนส่ง' },
  ]
  for (const d of damagedItems) {
    await prisma.productItem.update({ where: { id: d.item.id }, data: { status: 'DAMAGED', updatedAt: d.at } })
    await log('DAMAGE', { itemId: d.item.id, userId: warehouse1.id, details: { serialNumber: d.item.serial12, reason: d.reason }, at: d.at })
  }
  async function createDAR(cfg: { itemId: number; actionType: 'RESTORE' | 'SCRAP'; status: string; at: Date; approvedAt?: Date; repairNote?: string }) {
    const dar = await prisma.damagedActionRequest.create({
      data: {
        productItemId: cfg.itemId, actionType: cfg.actionType as never, status: cfg.status as never,
        repairNote: cfg.repairNote ?? null, createdById: warehouse1.id,
        approvedById: cfg.approvedAt ? manager1.id : null, approvedAt: cfg.approvedAt ?? null,
        createdAt: cfg.at, updatedAt: cfg.approvedAt ?? cfg.at,
      },
    })
    await log('DAMAGED_ACTION_REQUEST', { itemId: cfg.itemId, userId: warehouse1.id, details: { action: cfg.actionType, repairNote: cfg.repairNote }, at: cfg.at })
    return dar
  }
  await createDAR({ itemId: damagedItems[0].item.id, actionType: 'RESTORE', status: 'PENDING', at: D(7, 12, 10, 0), repairNote: 'เปลี่ยนบรรจุภัณฑ์ใหม่ได้ ตัวสินค้าไม่เสียหาย' })
  await createDAR({ itemId: damagedItems[2].item.id, actionType: 'SCRAP', status: 'PENDING', at: D(7, 13, 11, 30), repairNote: 'สินค้าเสียหายเกินกว่าจะซ่อมได้' })
  await createDAR({ itemId: damagedItems[4].item.id, actionType: 'RESTORE', status: 'APPROVED', at: D(6, 19, 9, 0), approvedAt: D(6, 20, 14, 0), repairNote: 'ตรวจสอบแล้วรอยร้าวอยู่ที่กล่องนอก ตัวขวดสมบูรณ์' })
  await prisma.productItem.update({ where: { id: damagedItems[4].item.id }, data: { status: 'IN_STOCK', updatedAt: D(6, 20, 14, 0) } })
  await log('APPROVE', { itemId: damagedItems[4].item.id, userId: manager1.id, details: { action: 'RESTORE', serialNumber: damagedItems[4].item.serial12 }, at: D(6, 20, 14, 0) })
  for (const idx of [5, 6]) {
    await createDAR({ itemId: damagedItems[idx].item.id, actionType: 'SCRAP', status: 'APPROVED', at: D(5, 28, 10, 30), approvedAt: D(5, 30, 11, 0) })
    await prisma.productItem.update({ where: { id: damagedItems[idx].item.id }, data: { status: 'SCRAPPED', updatedAt: D(5, 30, 11, 0) } })
    await log('APPROVE', { itemId: damagedItems[idx].item.id, userId: manager1.id, details: { action: 'SCRAP', serialNumber: damagedItems[idx].item.serial12 }, at: D(5, 30, 11, 0) })
  }
  console.log('✅ Section 9: 7 damaged items, 5 action requests')

  // ---------- Section 10: damaged claims ----------
  const claimsDir = path.join(process.cwd(), 'public', 'uploads', 'claims')
  const attach = (file: string) => {
    const stat = fs.statSync(path.join(claimsDir, file))
    const ext = path.extname(file).toLowerCase()
    const fileType = ext === '.png' ? 'image/png' : ext === '.pdf' ? 'application/pdf' : 'application/octet-stream'
    return { fileUrl: `/uploads/claims/${file}`, fileName: file, fileType, fileSize: stat.size }
  }
  async function createClaim(cfg: {
    clinicId: number; master: Master; quantity: number; reason: string; note?: string
    status: string; at: Date; approvedAt?: Date; files: string[]
  }) {
    const claimNumber = await generateClaimNumber()
    return prisma.damagedClaim.create({
      data: {
        claimNumber, clinicId: cfg.clinicId, productMasterId: cfg.master.id, quantity: cfg.quantity,
        reason: cfg.reason, note: cfg.note ?? null, status: cfg.status as never,
        createdById: warehouse1.id, approvedById: cfg.approvedAt ? manager1.id : null,
        approvedAt: cfg.approvedAt ?? null, createdAt: cfg.at, updatedAt: cfg.approvedAt ?? cfg.at,
        attachments: { create: cfg.files.map((f) => ({ ...attach(f), createdAt: cfg.at })) },
      },
    })
  }
  const clm1 = await createClaim({
    clinicId: 1, master: M.BBN01, quantity: 2, status: 'PENDING', at: D(7, 11, 14, 30),
    reason: 'สินค้าแตกเสียหายระหว่างขนส่ง', note: 'คลินิกแจ้งว่ากล่องด้านนอกบุบและขวดด้านในแตก 2 ขวด',
    files: ['1772702451027-swkdx69g6u.png', '1772703084560-cizmn2n7v8p.pdf'],
  })
  const clm2 = await createClaim({
    clinicId: clinic4.id, master: M.TPR01, quantity: 1, status: 'PENDING', at: D(7, 14, 11, 15),
    reason: 'บรรจุภัณฑ์บุบและฉลากหลุด',
    files: ['1772704613335-x700twnc8zp.png'],
  })
  const clm3 = await createClaim({
    clinicId: 3, master: M.TSN01, quantity: 3, status: 'APPROVED', at: D(6, 5, 10, 0), approvedAt: D(6, 6, 15, 30),
    reason: 'สินค้าหมดอายุก่อนกำหนดที่ระบุบนฉลาก', note: 'ตรวจสอบล็อตแล้ว อนุมัติเปลี่ยนสินค้าใหม่ให้คลินิก',
    files: ['1772703980149-293owhfckt1.pdf', '1772704763037-51vzi8176bc.pdf'],
  })
  console.log(`✅ Section 10: claims ${clm1.claimNumber} … ${clm3.claimNumber}`)

  // ---------- Section 11: extra scan logs ----------
  const allTracked = await prisma.productItem.findMany({
    where: { status: { in: ['SHIPPED', 'ACTIVATED', 'RETURNED'] } },
    orderBy: { id: 'asc' },
  })
  let extraScans = 0
  // pre-activation clinic scans spread Feb–Jul
  for (let i = 0; i < 30; i++) {
    const item = pick(allTracked)
    const at = new Date(D(2, 21).getTime() + rand() * (D(7, 12).getTime() - D(2, 21).getTime()))
    await scan(item.id, 'GENUINE_SHIPPED', at)
    extraScans++
  }
  const activatedAll = await prisma.productItem.findMany({ where: { status: 'ACTIVATED' } })
  for (let i = 0; i < 15; i++) {
    const item = pick(activatedAll)
    const at = new Date(D(4, 1).getTime() + rand() * (D(7, 13).getTime() - D(4, 1).getTime()))
    await scan(item.id, 'ACTIVATED', at)
    extraScans++
  }
  const inStockAll = await prisma.productItem.findMany({ where: { status: 'IN_STOCK' }, take: 20 })
  for (let i = 0; i < 6; i++) {
    const item = pick(inStockAll)
    const at = new Date(D(3, 1).getTime() + rand() * (D(7, 10).getTime() - D(3, 1).getTime()))
    await scan(item.id, 'GENUINE_IN_STOCK', at)
    extraScans++
  }
  for (let i = 0; i < 5; i++) {
    const item = pick(allTracked)
    const at = new Date(D(3, 15).getTime() + rand() * (D(7, 8).getTime() - D(3, 15).getTime()))
    await scan(item.id, 'INVALID_TOKEN', at, 1, null)
    extraScans++
  }
  for (let i = 0; i < 4; i++) {
    const item = pick(allTracked)
    const at = new Date(D(4, 10).getTime() + rand() * (D(7, 5).getTime() - D(4, 10).getTime()))
    await scan(item.id, 'NOT_FOUND', at, 1, null)
    extraScans++
  }
  // guarantee ≥8 scans today for the dashboard KPI
  for (let i = 0; i < 9; i++) {
    const item = pick(allTracked)
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8 + Math.floor(i / 2), 10 + i * 5)
    await scan(item.id, item.status === 'ACTIVATED' ? 'ACTIVATED' : 'GENUINE_SHIPPED', at)
    extraScans++
  }
  console.log(`✅ Section 11: ${extraScans} extra scan logs`)

  // ---------- Section 12: system settings ----------
  const settings: Record<string, string> = {
    'verify.showClinicName': 'true',
    'verify.showBranchInfo': 'true',
    'verify.showClinicAddress': 'true',
    'label.widthMm': '20',
    'label.heightMm': '34',
  }
  for (const [key, value] of Object.entries(settings)) {
    await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
  }
  console.log('✅ Section 12: system settings')

  // ---------- Section 13: summary ----------
  const statusCounts = await prisma.productItem.groupBy({ by: ['status'], _count: true })
  const activationCount = await prisma.activation.count()
  const scanCount = await prisma.scanLog.count()
  const eventCount = await prisma.eventLog.count()

  // pick reference records for the screenshot run
  const verifyItem = (await prisma.productItem.findFirst({ where: { status: 'SHIPPED', assignedClinicId: clinic4.id }, orderBy: { id: 'asc' } }))!
  const activateItem = (await prisma.productItem.findFirst({
    where: { status: 'SHIPPED', assignedClinicId: clinic4.id, id: { not: verifyItem.id } },
    orderBy: { id: 'asc' },
  }))!
  const activateTokenRow = await prisma.qRToken.findFirstOrThrow({ where: { productItemId: activateItem.id, status: 'ACTIVE' } })
  const scansPerItem = await prisma.scanLog.groupBy({ by: ['productItemId'], _count: true, orderBy: { _count: { productItemId: 'desc' } }, take: 1 })
  const itemDetailId = scansPerItem[0].productItemId

  const ids = {
    grn1: grn1.header.id, grn1No: grn1.grnNo,
    grn2: grn2.header.id, grn2No: grn2.grnNo,
    grn3: grn3.header.id, grn3No: grn3.grnNo,
    batchId: batch.id, batchNo,
    po1: po1.id, po1No: po1.poNo,
    out1: out1.header.id, out1No: out1.deliveryNoteNo,
    out6: out6.header.id, out6No: out6.deliveryNoteNo,
    br1: br1.header.id, br1No: br1.transactionNo,
    clm1: clm1.id, clm1No: clm1.claimNumber,
    bbn01MasterId: M.BBN01.id,
    itemDetailId,
    verifySerial: verifyItem.serial12,
    activateToken: activateTokenRow.token,
    clinicDetailId: 1,
    analyticsClinicId: 1,
  }
  const outDir = path.join(process.cwd(), 'docs', 'screenshots')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, '_seed-ids.json'), JSON.stringify(ids, null, 2), 'utf-8')

  console.log('')
  console.log('🎉 Demo data seeded!')
  console.log('')
  console.log('📊 Product item status counts:')
  for (const row of statusCounts.sort((a, b) => b._count - a._count)) {
    console.log(`   ${row.status.padEnd(14)} ${row._count}`)
  }
  console.log(`   TOTAL          ${statusCounts.reduce((s, r) => s + r._count, 0)}`)
  console.log(`📈 Activations: ${activationCount} · ScanLogs: ${scanCount} · EventLogs: ${eventCount}`)
  console.log('')
  console.log('🔑 Reference IDs written to docs/screenshots/_seed-ids.json')
  console.log(`   verify:   /th/verify?serial=${ids.verifySerial}`)
  console.log(`   activate: /th/activate?token=${encodeURIComponent(ids.activateToken ?? '').slice(0, 60)}...`)
  console.log(`   item detail: /th/dashboard/products/item/${ids.itemDetailId}`)
}

main()
  .catch((e) => {
    console.error('❌ Demo seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
