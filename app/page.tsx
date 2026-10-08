export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center font-sans">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Bug Hunt Race 🐛
      </h1>
      <p className="max-w-md text-lg opacity-80">
        Race your team to fix buggy code. Fastest correct fix wins.
      </p>
    </main>
  );
}
