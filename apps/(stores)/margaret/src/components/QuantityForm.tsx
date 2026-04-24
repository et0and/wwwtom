"use client";

import { useState } from "react";
import { storefrontCopy } from "@/app/(frontend)/copy";

type Props = {
  productSlug: string;
  maxQuantity: number;
};

export const QuantityForm = ({ productSlug, maxQuantity }: Props) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = storefrontCopy.productDetail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug, quantity }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? copy.genericCheckoutError);
      setLoading(false);
      return;
    }

    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="quantity" className="field-label">
        {copy.quantityLabel}
      </label>
      <input
        id="quantity"
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        disabled={loading}
        className="field-input"
      />
      <button type="submit" disabled={loading} className="button-primary">
        {loading ? copy.submitLoadingLabel : copy.submitLabel}
      </button>
      {error && (
        <p role="alert" className="feedback-error">
          {error}
        </p>
      )}
    </form>
  );
};
