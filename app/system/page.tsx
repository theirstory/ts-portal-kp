import { redirect } from 'next/navigation';

/** The System section now lives on the Memory Map page. */
export default function SystemPage() {
  redirect('/memory-map#system');
}
