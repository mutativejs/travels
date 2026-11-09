import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/not-found-page';

export const metadata: Metadata = {
  title: '页面未找到',
};

export default function NotFound() {
  return <NotFoundPage locale="zh" />;
}
