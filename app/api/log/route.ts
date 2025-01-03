import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const client = new PrismaClient();

export async function GET() {
  try {
    const data = await client.log.findMany();
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await client.log.create({ data: body });
    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...body } = await request.json();
    const response = await client.log.updateMany({
      where: { id: id },
      data: { ...body },
    });
    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await client.log.deleteMany({
      where: { id: body.id },
    });
    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}
