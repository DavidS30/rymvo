import { auth } from "@clerk/nextjs/server";
import { getAvailableSlots } from "@repo/core/services";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return Response.json(
      { error: "Falta parámetro: date (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { error: "Formato de fecha inválido. Usar YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const slots = await getAvailableSlots(date);
    return Response.json({ availableSlots: slots });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
