"use client";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

// baseURL is inferred from window.location in the browser. For SSR contexts
// (rare for auth-client usage), Better-Auth falls back to relative paths.
//
// usernameClient() mirrors the server-side username plugin so the client SDK
// gets typed access to authClient.signIn.username, authClient.updateUser
// extended with username/displayUsername, etc.
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
