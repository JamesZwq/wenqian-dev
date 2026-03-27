import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Paper Manager',
  description: 'Automated literature management with DBLP and AI classification',
};

export default function PapersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
