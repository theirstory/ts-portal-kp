import { notFound } from 'next/navigation';
import { loadEvidenceIndex } from '@/lib/insights/loadEvidenceBank';
import { QuestionView } from '../../Components/QuestionView';

export default async function QuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const id = Number.parseInt(questionId, 10);

  if (!loadEvidenceIndex().getQuestion(id)) notFound();

  return <QuestionView questionId={id} />;
}
