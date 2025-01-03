import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const client = new PrismaClient();

export async function GET() {
  try {
    const data = await client.activity.findMany();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await client.activity.create({ data: body });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { oldName, ...body } = await request.json();
    const response = await client.activity.updateMany({
      where: { name: oldName },
      data: body,
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await client.activity.deleteMany({
      where: { name: body.name },
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}
