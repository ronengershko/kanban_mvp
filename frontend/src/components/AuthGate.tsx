"use client";

import { FormEvent, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { loginUser, registerUser } from "@/lib/api";

type AuthGateProps = {
  defaultUsername?: string;
};

export const AuthGate = ({ defaultUsername }: AuthGateProps = {}) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState(defaultUsername ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authenticatedUsername, setAuthenticatedUsername] = useState("");

  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (!isLogin) await registerUser(username, password);
      await loginUser(username, password);
      setAuthenticatedUsername(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    setAuthenticatedUsername("");
    setUsername("");
    setPassword("");
    setError("");
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError("");
  }

  if (authenticatedUsername) {
    return <KanbanBoard username={authenticatedUsername} onLogout={handleLogout} />;
  }

  const submitLabel = isLoading
    ? (isLogin ? "Signing in..." : "Creating account...")
    : (isLogin ? "Sign in" : "Create account");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <section className="w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow)]">
        <h1 className="text-3xl font-semibold text-[var(--navy-dark)]">
          {isLogin ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-[var(--gray-text)]">
          {isLogin
            ? "Sign in to access your Kanban boards."
            : "Pick a username and password to get started."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-[var(--navy-dark)]" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-[var(--navy-dark)]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--navy-dark)]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-[var(--navy-dark)]"
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[var(--secondary-purple)] px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--gray-text)]">
          {isLogin ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold text-[var(--primary-blue)] hover:underline"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-semibold text-[var(--primary-blue)] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </section>
    </main>
  );
};
