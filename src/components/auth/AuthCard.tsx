interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Centered pixel-themed card used by every (auth)/* page.
 *
 * No motion here. The site-wide <PageTransition> already wraps every page in
 * a fade+rise motion.div; nesting another framer-motion variants div inside
 * was causing the SSR'd \`opacity:0\` initial state to never animate to
 * visible (hydration mismatch left the card invisible). Keep the visual
 * styling, drop the redundant motion.
 */
export function AuthCard({ title, subtitle, children }: Props) {
  return (
    <div
      className="w-full max-w-md rounded-2xl border-2 p-6 md:p-8 shadow-xl"
      style={{
        background: "var(--pixel-card-bg)",
        borderColor: "var(--pixel-border)",
        boxShadow: "0 12px 40px var(--pixel-glow)",
      }}
    >
      <h1
        className="font-sans font-bold tracking-tight text-2xl md:text-3xl mb-1"
        style={{
          background: "linear-gradient(135deg, var(--pixel-accent), var(--pixel-accent-2))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="font-mono text-xs md:text-sm mb-6" style={{ color: "var(--pixel-muted)" }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
