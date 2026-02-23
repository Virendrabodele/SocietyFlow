import { PrismaClient } from '../src/generated/prisma';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create master admin
  const masterAdmin = await prisma.user.upsert({
    where: { email: 'admin@societyflow.com' },
    update: {},
    create: {
      name: 'Master Admin',
      email: 'admin@societyflow.com',
      mobile: '9876543210',
      passwordHash: await hashPassword('Admin@123'),
      role: 'MASTER_ADMIN',
      isActive: true,
    },
  });

  console.log('✓ Created master admin:', masterAdmin.email);

  // Create a sample society
  const society = await prisma.society.upsert({
    where: { code: 'GPA001' },
    update: {},
    create: {
      name: 'Green Park Apartments',
      code: 'GPA001',
      city: 'Mumbai',
      state: 'Maharashtra',
      units: 50,
      createdByUserId: masterAdmin.id,
    },
  });

  console.log('✓ Created society:', society.name);

  // Grant admin access to master admin
  await prisma.societyAccess.upsert({
    where: {
      societyId_userId: {
        societyId: society.id,
        userId: masterAdmin.id,
      },
    },
    update: {},
    create: {
      societyId: society.id,
      userId: masterAdmin.id,
      accessRole: 'ADMIN',
      grantedByUserId: masterAdmin.id,
    },
  });

  // Create a society admin user
  const societyAdmin = await prisma.user.upsert({
    where: { email: 'admin@greenpark.com' },
    update: {},
    create: {
      name: 'Society Admin',
      email: 'admin@greenpark.com',
      mobile: '9876543211',
      passwordHash: await hashPassword('Admin@123'),
      role: 'SOCIETY_ADMIN',
      isActive: true,
    },
  });

  console.log('✓ Created society admin:', societyAdmin.email);

  // Grant admin access to society admin
  await prisma.societyAccess.upsert({
    where: {
      societyId_userId: {
        societyId: society.id,
        userId: societyAdmin.id,
      },
    },
    update: {},
    create: {
      societyId: society.id,
      userId: societyAdmin.id,
      accessRole: 'ADMIN',
      grantedByUserId: masterAdmin.id,
    },
  });

  // Create sample members
  const members = [
    {
      name: 'Rajesh Kumar',
      unitNo: 'A-101',
      phone: '9876543210',
      email: 'rajesh@example.com',
      variables: { bhk: 2, sqft: 1200, waterReading: 0, dgReading: 0, meterReading: 0 },
    },
    {
      name: 'Priya Sharma',
      unitNo: 'A-102',
      phone: '9876543211',
      email: 'priya@example.com',
      variables: { bhk: 3, sqft: 1500, waterReading: 0, dgReading: 0, meterReading: 0 },
    },
    {
      name: 'Amit Patel',
      unitNo: 'B-201',
      phone: '9876543212',
      email: 'amit@example.com',
      variables: { bhk: 2, sqft: 1100, waterReading: 0, dgReading: 0, meterReading: 0 },
    },
    {
      name: 'Sneha Desai',
      unitNo: 'B-202',
      phone: '9876543213',
      email: 'sneha@example.com',
      variables: { bhk: 3, sqft: 1600, waterReading: 0, dgReading: 0, meterReading: 0 },
    },
    {
      name: 'Vikram Singh',
      unitNo: 'C-301',
      phone: '9876543214',
      email: 'vikram@example.com',
      variables: { bhk: 4, sqft: 2000, waterReading: 0, dgReading: 0, meterReading: 0 },
    },
  ];

  for (const memberData of members) {
    await prisma.member.upsert({
      where: {
        societyId_unitNo: {
          societyId: society.id,
          unitNo: memberData.unitNo,
        },
      },
      update: {},
      create: {
        societyId: society.id,
        ...memberData,
        status: 'ACTIVE',
      },
    });
  }

  console.log(`✓ Created ${members.length} sample members`);

  // Create billing heads
  const maintenanceHead = await prisma.billingHead.upsert({
    where: { id: 'maintenance-head-seed' },
    update: {},
    create: {
      id: 'maintenance-head-seed',
      societyId: society.id,
      name: 'Monthly Maintenance',
      isActive: true,
      sortOrder: 1,
    },
  });

  console.log('✓ Created billing head:', maintenanceHead.name);

  // Create billing line items
  const lineItems = [
    {
      name: 'Base Maintenance (per BHK)',
      basisType: 'PER_BHK',
      rate: 1000,
      taxable: true,
    },
    {
      name: 'Common Area Maintenance',
      basisType: 'FLAT',
      rate: 500,
      taxable: true,
    },
    {
      name: 'Water Charges',
      basisType: 'FLAT',
      rate: 200,
      taxable: false,
    },
    {
      name: 'Electricity (Common)',
      basisType: 'FLAT',
      rate: 300,
      taxable: false,
    },
  ];

  for (const itemData of lineItems) {
    await prisma.billingLineItem.create({
      data: {
        billingHeadId: maintenanceHead.id,
        societyId: society.id,
        ...itemData,
        frequency: 'MONTHLY',
        isActive: true,
      },
    });
  }

  console.log(`✓ Created ${lineItems.length} billing line items`);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: masterAdmin.id,
      societyId: society.id,
      action: 'database_seed',
      entityType: 'system',
      payload: {
        message: 'Database seeded with sample data',
      },
    },
  });

  console.log('✓ Database seed completed successfully!');
  console.log('\nSample Login Credentials:');
  console.log('Master Admin: admin@societyflow.com / Admin@123');
  console.log('Society Admin: admin@greenpark.com / Admin@123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
