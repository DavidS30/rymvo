"use client";

import { useEffect, useState } from "react";

type Role = "PASSENGER" | "DRIVER" | "ADMIN";
type User = { id: string; fullName: string; email: string; role: Role };

const labels: Record<Role, string> = { PASSENGER: "Pasajero", DRIVER: "Conductor", ADMIN: "Administrador" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    const response = await fetch("/api/v1/admin/users");
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "No se pudieron cargar los usuarios");
    else setUsers(data.data);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId: string, role: Role) => {
    const response = await fetch("/api/v1/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) });
    if (!response.ok) { const data = await response.json(); setError(data.error ?? "No se pudo actualizar el rol"); return; }
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, role } : user));
  };

  return <div className="p-8"><div className="mb-8"><p className="rymvo-eyebrow">Accesos y permisos</p><h1 className="mt-2 text-2xl font-bold">Usuarios</h1><p className="mt-1 text-sm text-gray-500">Asigna el rol adecuado. Los conductores aprobados aparecerán en el selector de reservas.</p></div>{error && <p className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}<div className="overflow-hidden rounded-xl border bg-white shadow-sm"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-gray-50 text-xs uppercase text-gray-500"><th className="px-5 py-3">Usuario</th><th className="px-5 py-3">Correo</th><th className="px-5 py-3">Rol</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b hover:bg-gray-50"><td className="px-5 py-4 font-medium">{user.fullName}</td><td className="px-5 py-4 text-gray-600">{user.email}</td><td className="px-5 py-4"><select value={user.role} onChange={(event) => changeRole(user.id, event.target.value as Role)} className="rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold"><option value="PASSENGER">{labels.PASSENGER}</option><option value="DRIVER">{labels.DRIVER}</option><option value="ADMIN">{labels.ADMIN}</option></select></td></tr>)}</tbody></table></div></div>;
}
