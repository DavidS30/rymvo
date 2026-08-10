import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { redirect } from "next/navigation";

export default async function DashboardRedirect() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/dashboard");

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  if (user?.role === "ADMIN") redirect("/admin/bookings");
  if (user?.role === "DRIVER") redirect("/driver/schedule");
  redirect("/passenger/book");
}
