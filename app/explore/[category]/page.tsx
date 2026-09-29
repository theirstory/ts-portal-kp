import { notFound } from 'next/navigation';
import { loadEvidenceIndex } from '@/lib/insights/loadEvidenceBank';
import { ThemeView } from '../Components/ThemeView';

export default async function ThemePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;

  if (!loadEvidenceIndex().getThemeBySlug(category)) notFound();

  return <ThemeView slug={category} />;
}
