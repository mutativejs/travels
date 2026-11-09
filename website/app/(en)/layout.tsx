import type { ReactNode } from 'react';
import { RootDocument } from '@/components/root-document';
import { createRootMetadata } from '@/lib/metadata';
import '../global.css';

export const metadata = createRootMetadata('en');

export default function Layout({ children }: { children: ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
