"use client";

import { useState } from "react";

type Props = {
  productSlug: string;
  maxQuantity: number;
};

export const QuantityForm = ({ productSlug, maxQuantity }: Props) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError((body as { error?: string }).error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="quantity">Quantity</label>
      <input
        id="quantity"
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Redirecting…" : "Buy Now"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
};
