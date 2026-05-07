"use client";
import { createAuthClient } from "better-auth/react";

// baseURL is inferred from window.location in the browser. For SSR contexts
// (rare for auth-client usage), Better-Auth falls back to relative paths.
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;
