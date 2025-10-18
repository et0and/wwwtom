import { json } from "solid-start/api";
import { getDynamicProducts } from "~/products";

export async function GET({ request }: { request: Request }) {
  try {
    const products = await getDynamicProducts(request.d1);
    return json(products);
  } catch (error) {
    console.error("Error fetching dynamic products:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
