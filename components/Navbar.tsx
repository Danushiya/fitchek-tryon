import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight"
        >
          FITCHEK
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/playground"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            Try-On
          </Link>

          <Link
            href="/history"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            History
          </Link>
        </div>
      </nav>
    </header>
  );
}
