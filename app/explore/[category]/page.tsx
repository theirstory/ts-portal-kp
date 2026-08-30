import { notFound } from 'next/navigation';
import { getThemeBySlug, themes } from '@/lib/insights/evidenceBank';
import { ThemeView } from '../Components/ThemeView';

export function generateStaticParams() {
  return themes.map((theme) => ({ category: theme.slug }));
}

export default async function ThemePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const theme = getThemeBySlug(category);

  if (!theme) notFound();

  return <ThemeView theme={theme} />;
}
