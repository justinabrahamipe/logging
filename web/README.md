# Logging Application

A comprehensive life tracking application built with Next.js that helps you log and manage different aspects of your life including activities, time tracking, and todos.

## Features

- **Activities Management** - Create and manage custom logging categories with icons, colors, and categories
- **Time Logging** - Track time spent on activities with start/end times and comments
- **Todo Lists** - Organize tasks with priorities (importance/urgency matrix), deadlines, and activity associations
- **Modern UI** - Beautiful, responsive interface with smooth animations using Framer Motion
- **Dark Mode Support** - Built-in dark mode for comfortable viewing
- **Real-time Updates** - Dynamic data updates across all features

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Styling**: TailwindCSS
- **UI Components**: [Flowbite React](https://flowbite-react.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: React Icons
- **HTTP Client**: Axios
- **Date Handling**: date-fns, Luxon

## Prerequisites

Before you begin, ensure you have installed:

- Node.js (v20 or higher)
- npm, yarn, pnpm, or bun
- PostgreSQL database (or use a cloud provider like Neon, Supabase, etc.)

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd logging
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

Replace the connection string with your PostgreSQL database credentials.

### 4. Set up the database

Generate Prisma Client and run migrations:

```bash
npx prisma generate
npx prisma db push
```

To view and manage your database with Prisma Studio:

```bash
npx prisma studio
```

### 5. Run the development server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

```
logging/
├── app/
│   ├── activities/       # Activity management pages
│   ├── api/             # API routes
│   ├── log/             # Logging pages
│   ├── todo/            # Todo management pages
│   ├── (common)/        # Shared components
│   ├── (utilities)/     # Utility functions
│   ├── (@types)/        # TypeScript type definitions
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── prisma/
│   └── schema.prisma    # Database schema
├── public/              # Static assets
└── ...config files
```

## Database Schema

The application uses three main models:

- **Activity**: Logging categories with custom icons, titles, and colors
- **Log**: Individual log entries with time tracking and activity references
- **Todo**: Task management with priority matrix and deadlines

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Routes

The application includes API routes for:

- `/api/activities` - CRUD operations for activities
- `/api/log` - CRUD operations for logs
- `/api/todo` - CRUD operations for todos

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and not licensed for public use.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI inspired by modern productivity tools
- Icons from [React Icons](https://react-icons.github.io/react-icons/)
