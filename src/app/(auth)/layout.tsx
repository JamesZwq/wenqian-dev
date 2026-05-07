// DEBUG: temporarily sync layout (no async getSession() / redirect) to bisect
// the rendering issue on auth pages. Will restore after diagnosis.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--pixel-bg)" }}
    >
      <div className="w-full flex justify-center">{children}</div>
    </div>
  );
}
