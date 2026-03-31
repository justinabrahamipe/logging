import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId();

    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (!user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: "https://www.grindconsole.com/premium",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}
