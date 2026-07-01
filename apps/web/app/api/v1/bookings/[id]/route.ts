import { auth } from "@clerk/nextjs/server";
import { getBookingById } from "@repo/core/services";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const booking = await getBookingById(id, userId, "USER");
    return Response.json(booking);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("No autorizado")) {
      return Response.json({ error: message }, { status: 403 });
    }
    if (message.includes("no encontrada")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 400 });
  }
}
