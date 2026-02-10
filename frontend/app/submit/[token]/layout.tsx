import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Submit Challenge - MentorLed',
  description: 'Submit your challenge for the MentorLed program',
};

export default function SubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
