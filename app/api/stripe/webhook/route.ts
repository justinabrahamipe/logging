import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db, userPreferences, users } from "@/lib/db";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // New subscription or successful payment
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email || session.customer_email;
        if (email) {
          await activatePremium(email);
        }
        break;
      }

      // Recurring payment succeeded
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const email = invoice.customer_email;
        if (email) {
          await activatePremium(email);
        }
        break;
      }

      // Subscription cancelled or payment failed
      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const obj = event.data.object;
        let email: string | null = null;

        if (event.type === "customer.subscription.deleted") {
          const sub = obj as Stripe.Subscription;
          const customer = await stripe.customers.retrieve(sub.customer as string);
          if (!customer.deleted) email = customer.email;
        } else {
          const invoice = obj as Stripe.Invoice;
          email = invoice.customer_email;
        }

        if (email) {
          await deactivatePremium(email);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function activatePremium(email: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) return;

  const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id));
  if (existing) {
    await db.update(userPreferences)
      .set({ isPremium: true, premiumActivatedAt: new Date(), promoCode: "stripe" })
      .where(eq(userPreferences.userId, user.id));
  } else {
    await db.insert(userPreferences).values({
      userId: user.id,
      isPremium: true,
      premiumActivatedAt: new Date(),
      promoCode: "stripe",
    });
  }
}

async function deactivatePremium(email: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) return;

  await db.update(userPreferences)
    .set({ isPremium: false })
    .where(eq(userPreferences.userId, user.id));
}
