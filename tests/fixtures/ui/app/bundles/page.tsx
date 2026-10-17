import { BundleList } from "@/components/commerce";
import { mixed, printedPair, ebookPair } from "../../data";
export default function Page() { return <BundleList bundles={[printedPair, ebookPair, mixed]} />; }
