import { redirect } from 'next/navigation'

type PageProps = {
  params: { title: string }
}

// /sutra/经名 重定向到 /sutra/经名/1
export default function SutraPage({ params }: PageProps) {
  redirect(`/sutra/${params.title}/1`)
}
