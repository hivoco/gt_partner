import Link from "next/link";

type Props = { searchParams: Promise<{ name?: string }> };

export default async function ThankYou({ searchParams }: Props) {
  const { name } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
        <svg viewBox="0 0 24 24" className="size-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-bold">Thank you{name ? `, ${name}` : ""}!</h1>
      <p className="mt-3 text-slate-600">
        We&apos;ve received your details. Our partner team will contact you shortly on your registered number.
      </p>
      <Link href="/" className="mt-8 text-sm font-medium text-brand underline underline-offset-4">
        Submit another response
      </Link>
    </main>
  );
}
