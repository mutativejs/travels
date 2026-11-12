import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { homeOptions } from '@/lib/layout.shared';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <HomeLayout {...homeOptions('zh')}>{children}</HomeLayout>;
}
