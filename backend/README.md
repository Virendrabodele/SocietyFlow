# SocietyFlow Backend API

Production-ready backend API for SocietyFlow - A comprehensive society management system.

## 🚀 Features

- **Multi-tenant Architecture**: Support for multiple societies with role-based access control
- **Secure Authentication**: JWT-based auth with access and refresh tokens
- **Role-Based Access Control**: MASTER_ADMIN, SOCIETY_ADMIN, COMMITTEE_USER, RESIDENT roles
- **Invoice Generation Engine**: Flexible billing system with multiple calculation methods
- **Formula Evaluator**: Safe formula evaluation for custom billing calculations
- **Notification System**: Email and SMS notifications for invoices
- **Audit Logging**: Comprehensive audit trail for all critical operations
- **Payment & Receipt Management**: Track payments and generate receipts
- **Google Sheets Integration**: Sync data with Google Sheets
- **Production-Ready**: Docker support, security best practices, rate limiting

## 🛠 Tech Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod
- **Email**: Nodemailer (SMTP) / SendGrid
- **SMS**: Twilio / MSG91
- **Queue**: BullMQ with Redis
- **Security**: Helmet, bcrypt, CORS, rate limiting

## 📋 Prerequisites

- Node.js 20 or higher
- PostgreSQL 16 or higher
- Redis (optional, for notification queues)
- npm or yarn

## 🔧 Installation

### 1. Clone the repository

\`\`\`bash
git clone https://github.com/Virendrabodele/SocietyFlow.git
cd SocietyFlow/backend
\`\`\`

### 2. Install dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Set up environment variables

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` with your configuration:

\`\`\`env
DATABASE_URL="postgresql://user:password@localhost:5432/societyflow?schema=public"
JWT_ACCESS_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
\`\`\`

### 4. Generate Prisma client

\`\`\`bash
npm run prisma:generate
\`\`\`

### 5. Run database migrations

\`\`\`bash
npm run prisma:migrate
\`\`\`

### 6. Seed the database (optional)

\`\`\`bash
npm run prisma:seed
\`\`\`

This creates:
- Master admin: admin@societyflow.com / Admin@123
- Society admin: admin@greenpark.com / Admin@123
- Sample society with members and billing configuration

### 7. Start the development server

\`\`\`bash
npm run dev
\`\`\`

The API will be available at http://localhost:3000/api/v1

## 🐳 Docker Setup

### Using Docker Compose (Recommended)

\`\`\`bash
docker-compose up -d
\`\`\`

This starts:
- PostgreSQL database on port 5432
- Redis on port 6379
- API server on port 3000

Access the API at http://localhost:3000/api/v1

### Manual Docker Build

\`\`\`bash
docker build -t societyflow-api .
docker run -p 3000:3000 --env-file .env societyflow-api
\`\`\`

## 📚 API Documentation

### Base URL

\`\`\`
http://localhost:3000/api/v1
\`\`\`

### Authentication Endpoints

#### Register User
\`\`\`http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password@123",
  "mobile": "9876543210",
  "role": "RESIDENT"
}
\`\`\`

#### Login
\`\`\`http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@societyflow.com",
  "password": "Admin@123"
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "...", "name": "...", "email": "...", "role": "..." },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
\`\`\`

### Society Endpoints

All protected endpoints require \`Authorization: Bearer <token>\` header.

#### Create Society (Master Admin Only)
\`\`\`http
POST /societies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Green Park Apartments",
  "code": "GPA001",
  "city": "Mumbai",
  "state": "Maharashtra",
  "units": 50
}
\`\`\`

#### Get Societies
\`\`\`http
GET /societies
Authorization: Bearer <token>
\`\`\`

#### Grant Society Access
\`\`\`http
POST /societies/:id/access
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com",
  "accessRole": "ADMIN"
}
\`\`\`

### Member Endpoints

#### Create Member
\`\`\`http
POST /societies/:id/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "unitNo": "A-101",
  "phone": "9876543210",
  "email": "rajesh@example.com",
  "status": "ACTIVE",
  "variables": {
    "bhk": 2,
    "sqft": 1200
  }
}
\`\`\`

#### Bulk Create Members
\`\`\`http
POST /societies/:id/members/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "members": [
    {
      "name": "Member 1",
      "unitNo": "A-101",
      "variables": { "bhk": 2 }
    },
    {
      "name": "Member 2",
      "unitNo": "A-102",
      "variables": { "bhk": 3 }
    }
  ]
}
\`\`\`

### Billing Configuration

#### Create Billing Head
\`\`\`http
POST /societies/:id/billing-heads
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Monthly Maintenance",
  "isActive": true,
  "sortOrder": 1
}
\`\`\`

#### Create Line Item
\`\`\`http
POST /societies/:id/billing-heads/:headId/line-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Base Maintenance",
  "basisType": "PER_BHK",
  "rate": 1000,
  "taxable": true,
  "frequency": "MONTHLY"
}
\`\`\`

**Supported Basis Types:**
- \`FLAT\`: Fixed amount
- \`PER_BHK\`: Amount per BHK
- \`PER_SQFT\`: Amount per square foot
- \`PER_WATER_READING\`: Per water meter reading
- \`PER_DG_READING\`: Per DG meter reading
- \`PER_METER_READING\`: Per electricity meter reading
- \`PER_CUSTOM_KEY\`: Per custom variable
- \`FORMULA\`: Custom formula evaluation

### Invoice Management

#### Generate Invoices
\`\`\`http
POST /societies/:id/invoices/generate?month=1&year=2024
Authorization: Bearer <token>
\`\`\`

#### Get Invoices
\`\`\`http
GET /societies/:id/invoices?month=1&year=2024&status=GENERATED
Authorization: Bearer <token>
\`\`\`

#### Get Invoice Details
\`\`\`http
GET /societies/:id/invoices/:invoiceId
Authorization: Bearer <token>
\`\`\`

### Payment & Receipt

#### Record Payment
\`\`\`http
POST /societies/:id/invoices/:invoiceId/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "amountPaid": 5000,
  "paidOn": "2024-01-15T10:00:00Z",
  "mode": "UPI",
  "referenceNo": "TXN123456",
  "notes": "Payment via PhonePe"
}
\`\`\`

#### Create Receipt
\`\`\`http
POST /societies/:id/invoices/:invoiceId/receipt
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiptNo": "RCP-2024-001",
  "issuedOn": "2024-01-15T10:00:00Z",
  "fileUrl": "https://storage.example.com/receipts/001.pdf"
}
\`\`\`

### Notifications

#### Send Invoice Notifications
\`\`\`http
POST /societies/:id/invoices/:invoiceId/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "channels": ["EMAIL", "SMS"]
}
\`\`\`

## 🔐 Security

### Authentication Flow

1. User logs in with email/password
2. Server returns access token (15 min expiry) and refresh token (7 days)
3. Client includes access token in Authorization header
4. When access token expires, use refresh token to get new access token

### Role-Based Access Control

- **MASTER_ADMIN**: Can create multiple societies, full access
- **SOCIETY_ADMIN**: Can manage assigned societies
- **COMMITTEE_USER**: Limited access to assigned societies
- **RESIDENT**: View-only access to own data

### Business Rules Enforced

- Only MASTER_ADMIN can create multiple societies
- Users can only access societies they're explicitly assigned to
- All operations are scoped by societyId
- Audit logs track all critical operations

## 📊 Database Schema

The database includes these main tables:

- **users**: User accounts with roles
- **societies**: Society information
- **society_access**: User-society access mappings
- **members**: Society members
- **billing_heads**: Billing categories
- **billing_line_items**: Individual billing line items
- **invoices**: Generated invoices
- **invoice_line_items**: Invoice line item details
- **payments**: Payment records
- **receipts**: Receipt records
- **notifications**: Email/SMS notification logs
- **audit_logs**: Audit trail
- **integrations**: Third-party integrations

## 🧪 Testing

\`\`\`bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage
\`\`\`

## 🚀 Deployment

### Production Build

\`\`\`bash
npm run build
npm start
\`\`\`

### Environment Variables for Production

Ensure these are set:

\`\`\`env
NODE_ENV=production
DATABASE_URL=<production-db-url>
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
REDIS_HOST=<redis-host>
REDIS_PASSWORD=<redis-password>
SMTP_HOST=<smtp-host>
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
\`\`\`

### Database Migrations in Production

\`\`\`bash
npx prisma migrate deploy
\`\`\`

## 📝 Scripts

- \`npm run dev\`: Start development server with hot reload
- \`npm run build\`: Build TypeScript to JavaScript
- \`npm start\`: Start production server
- \`npm run prisma:generate\`: Generate Prisma client
- \`npm run prisma:migrate\`: Run database migrations
- \`npm run prisma:studio\`: Open Prisma Studio (DB GUI)
- \`npm run prisma:seed\`: Seed database with sample data
- \`npm run lint\`: Run ESLint
- \`npm run format\`: Format code with Prettier

## 🔄 Frontend Integration

### localStorage to API Mapping

| localStorage Key | API Endpoint |
|-----------------|--------------|
| \`societyUsers\` | \`POST /auth/register\`, \`POST /auth/login\` |
| \`currentUser\` | \`POST /auth/login\` response |
| \`allSocieties\` | \`GET /societies\` |
| \`societyMembers_{id}\` | \`GET /societies/:id/members\` |
| \`societySettings_{id}\` | \`GET /societies/:id/billing-heads\` |

### Migration Steps

1. Replace localStorage authentication with API calls
2. Store JWT tokens in localStorage/sessionStorage
3. Include token in Authorization header for all requests
4. Replace all localStorage data operations with API calls
5. Implement token refresh logic

## 🐛 Troubleshooting

### Database Connection Issues

\`\`\`bash
# Test database connection
npx prisma db push
\`\`\`

### Port Already in Use

\`\`\`bash
# Change port in .env
PORT=3001
\`\`\`

### Prisma Client Issues

\`\`\`bash
# Regenerate Prisma client
npx prisma generate
\`\`\`

## 📄 License

ISC

## 👥 Contributors

- Master Admin (admin@societyflow.com)

## 🤝 Support

For issues and questions, please open an issue on GitHub.
