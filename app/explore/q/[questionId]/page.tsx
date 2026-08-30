import { notFound } from 'next/navigation';
import { evidenceQuestions, getQuestion } from '@/lib/insights/evidenceBank';
import { QuestionView } from '../../Components/QuestionView';

export function generateStaticParams() {
  return evidenceQuestions.map((question) => ({ questionId: String(question.question_id) }));
}

export default async function QuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const question = getQuestion(Number.parseInt(questionId, 10));

  if (!question) notFound();

  return <QuestionView question={question} />;
}
