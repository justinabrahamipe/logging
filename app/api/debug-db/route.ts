import { db } from '@/lib/db';
import { users, accounts } from '@/drizzle/schema';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const allUsers = await db.select().from(users);
    const allAccounts = await db.select().from(accounts);

    return NextResponse.json({
      users: allUsers,
      accounts: allAccounts,
      userCount: allUsers.length,
      accountCount: allAccounts.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
