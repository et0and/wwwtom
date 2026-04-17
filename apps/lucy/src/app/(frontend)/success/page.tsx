import type { Metadata } from "next";
import Link from "next/link";
import { siteNav } from "@/app/(frontend)/site-config";
import { SideBySide } from "@/components/SideBySide";

export const metadata: Metadata = {
  title: "Order Confirmed",
};

export default function SuccessPage() {
  return (
    <SideBySide nav={siteNav}>
      <div className="space-y-4 max-w-lg">
        <h1 className="text-2xl font-medium">Order confirmed</h1>
        <p className="text-gray-700">
          Thank you for your order. You will receive a confirmation email shortly.
        </p>
        <Link href="/products" className="underline">
          Continue shopping
        </Link>
      </div>
    </SideBySide>
  );
}
