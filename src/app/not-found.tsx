import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page empty">
      <h1>404</h1>
      <p>পাতাটি পাওয়া যায়নি · Page not found</p>
      <Link className="button" href="/">
        বইগুলো দেখুন · Explore books
      </Link>
    </div>
  );
}
