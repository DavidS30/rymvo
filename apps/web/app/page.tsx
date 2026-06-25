import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Rymvo</h1>
      <p className="text-xl text-muted-foreground">Transporte de lujo</p>

      {userId ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-green-600">Sesión iniciada</p>
          <UserButton afterSignOutUrl="/" />
        </div>
      ) : (
        <div className="flex gap-4">
          <SignInButton mode="modal">
            <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
              Iniciar sesión
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md border px-4 py-2">
              Registrarse
            </button>
          </SignUpButton>
        </div>
      )}
    </main>
  );
}
