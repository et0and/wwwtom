import Link from "next/link";
import { SideBySide } from "../../../components/SideBySide";
import "../styles.css";

export default async function HomePage() {
  return (
    <SideBySide
      left={
        <nav className="flex flex-col gap-4">
          <h1 className="text-xl font-medium lowercase">
            <Link href="/" className="link">
              Sophie Tremaine
            </Link>
          </h1>
          <div className="mt-4">
            <Link href="/about" className="block py-2 link">
              About
            </Link>
            <Link href="/posts" className="block py-2 link">
              Posts
            </Link>
          </div>
        </nav>
      }
    >
      <p>About meh</p>
    </SideBySide>
  );
}
