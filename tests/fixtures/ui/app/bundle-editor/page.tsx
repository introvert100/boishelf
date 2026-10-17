"use client";
import { useState } from "react";
import { CommerceAdmin } from "@/components/commerce-admin";
import { books, mixed, printedPair, ebookPair } from "../../data";
export default function Page() {
  const [notice, setNotice] = useState("");
  return <div className="container page">{notice && <p role="status">{notice}</p>}
    <CommerceAdmin books={books} bundles={[printedPair, ebookPair, mixed]} physicalOrders={[]}
      shipping={{ dhaka_paisa: 6000, outside_paisa: 12000 }} onSuccess={setNotice} />
  </div>;
}
