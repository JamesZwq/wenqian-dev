// DEBUG: minimal sign-in page. If this renders cleanly, the bug is in the
// imports / components I had before (authClient, AuthCard, PasswordField).
// Will restore after diagnosis.
"use client";

export default function SignInPage() {
  return (
    <div
      style={{
        background: "var(--pixel-card-bg)",
        borderColor: "var(--pixel-border)",
        color: "var(--pixel-text)",
        padding: "2rem",
        border: "2px solid",
        borderRadius: "1rem",
        maxWidth: "28rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>DEBUG sign-in</h1>
      <p>If you can read this, the auth page renders.</p>
      <input
        type="password"
        placeholder="control: this is a plain password input, no PasswordField"
        style={{
          marginTop: "1rem",
          padding: "0.5rem",
          border: "1px solid",
          borderColor: "var(--pixel-border)",
          background: "var(--pixel-bg-alt)",
          color: "var(--pixel-text)",
          width: "100%",
        }}
      />
    </div>
  );
}
