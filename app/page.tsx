import LeadForm from "./LeadForm";

type Props = { searchParams: Promise<{ phone?: string; name?: string; src?: string }> };

// The WhatsApp message can link to /?phone=98XXXXXXXX&name=... so the caller's details are prefilled.
export default async function Home({ searchParams }: Props) {
  const { phone = "", name = "", src = "whatsapp" } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="bg-brand px-5 pt-8 pb-16 text-white">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">GT Partner Program</p>
        <h1 className="mt-2 text-2xl leading-tight font-bold sm:text-3xl">Grow your store with us</h1>
        <p className="mt-2 text-sm text-white/80">
          Share a few details and our team will get in touch to take you through the partnership.
        </p>
      </header>

      <section className="-mt-10 flex-1 px-4 pb-10">
        <div className="rounded-2xl bg-white p-5 shadow-lg shadow-black/5 sm:p-7">
          <LeadForm defaults={{ phone, name }} source={src} />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Your details are used only to contact you about the GT Partner Program.
        </p>
      </section>
    </main>
  );
}
