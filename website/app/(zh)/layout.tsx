import type { ReactNode } from 'react';
import { RootDocument } from '@/components/root-document';
import { createRootMetadata } from '@/lib/metadata';
import '../global.css';

export const metadata = createRootMetadata('zh');

export default function Layout({ children }: { children: ReactNode }) {
  return <RootDocument locale="zh">{children}</RootDocument>;
}
