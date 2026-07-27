import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (!user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json({ error: "No customer found" }, { status: 404 });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    const sub = subscriptions.data[0];
    return NextResponse.json({
      nextBillingDate: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
      startDate: new Date(sub.start_date * 1000).toISOString(),
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
