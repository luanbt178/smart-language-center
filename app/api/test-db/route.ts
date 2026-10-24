import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const roles = await prisma.$queryRaw<
      Array<{
        id: bigint;
        code: string;
        name: string;
      }>
    >`
      SELECT id, code, name
      FROM roles
      ORDER BY id
    `;

    return NextResponse.json(
      roles.map((role) => ({
        ...role,
        id: role.id.toString(),
      }))
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Không thể kết nối database" },
      { status: 500 }
    );
  }
}