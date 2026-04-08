require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log('Seeding database...');
  const hash = await bcrypt.hash('Admin@123!', 12);
  await db.query(`
    INSERT INTO users (username, email, password, full_name, role)
    VALUES ('admin', 'admin@company.local', $1, 'System Administrator', 'admin')
    ON CONFLICT (username) DO NOTHING
  `, [hash]);
  console.log('✓ Admin user created: admin / Admin@123!');
  console.log('  !! Change password immediately after first login !!');
  await db.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
