import { shippingRates } from "@/lib/commerce";
import { PhysicalCart } from "@/components/commerce";
import { viewer } from "@/lib/auth";
import { books, mixed, printedPair } from "../../data";
export default async function Page() { return <PhysicalCart books={books} bundles={[printedPair, mixed]} viewer={await viewer()} ready={{cod: true, bkash: true}} deliveryDistricts={await shippingRates()} />; }
