import { PrismaClient, UserRole, LocationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Virtual Locations (warehouse_id: null)
  const virtualLocations = [
    { name: 'Vendor', code: 'VENDOR', location_type: LocationType.VENDOR },
    { name: 'Customer', code: 'CUSTOMER', location_type: LocationType.CUSTOMER },
    { name: 'Adjustment Virtual', code: 'ADJ_VIRT', location_type: LocationType.ADJUSTMENT_VIRTUAL },
  ];

  for (const loc of virtualLocations) {
    const existing = await prisma.location.findFirst({
      where: {
        code: loc.code,
        warehouse_id: null,
      },
    });

    if (!existing) {
      await prisma.location.create({
        data: {
          name: loc.name,
          code: loc.code,
          location_type: loc.location_type,
          warehouse_id: null,
        },
      });
      console.log(`Created virtual location: ${loc.name} (${loc.code})`);
    } else {
      console.log(`Virtual location already exists: ${loc.name} (${loc.code})`);
    }
  }

  // 2. Seed Default Units of Measure (UoM)
  const defaultUoms = [
    { name: 'Pieces', code: 'pcs' },
    { name: 'Kilograms', code: 'kg' },
    { name: 'Liters', code: 'ltr' },
    { name: 'Meters', code: 'm' },
  ];

  for (const uom of defaultUoms) {
    await prisma.unitOfMeasure.upsert({
      where: { code: uom.code },
      update: {},
      create: {
        name: uom.name,
        code: uom.code,
      },
    });
    console.log(`Ensured UoM: ${uom.name} (${uom.code})`);
  }

  // 3. Seed Default Category
  const defaultCategoryName = 'General';
  const existingCategory = await prisma.productCategory.findFirst({
    where: { name: defaultCategoryName, parent_category_id: null },
  });

  if (!existingCategory) {
    await prisma.productCategory.create({
      data: {
        name: defaultCategoryName,
      },
    });
    console.log(`Created default category: ${defaultCategoryName}`);
  } else {
    console.log(`Default category already exists: ${defaultCategoryName}`);
  }

  // 4. Seed Admin User
  const adminLoginId = 'admin';
  const existingAdmin = await prisma.user.findUnique({
    where: { login_id: adminLoginId },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@1234', 10);
    await prisma.user.create({
      data: {
        login_id: adminLoginId,
        email: 'admin@stocksense.local',
        full_name: 'System Administrator',
        password_hash: passwordHash,
        role: UserRole.INVENTORY_MANAGER,
        is_verified: true,
        is_active: true,
      },
    });
    console.log(`Created admin user: ${adminLoginId} (Password: Admin@1234)`);
  } else {
    console.log(`Admin user already exists: ${adminLoginId}`);
  }

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
