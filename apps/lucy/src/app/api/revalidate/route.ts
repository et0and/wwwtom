import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const path = searchParams.get("path");

  if (secret !== process.env.REVALIDATION_KEY) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  if (path == null || path.length === 0) {
    return NextResponse.json({ message: "Missing path parameter" }, { status: 400 });
  }

  revalidatePath(path);

  return NextResponse.json({ revalidated: true, path });
}
