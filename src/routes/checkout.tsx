import { createSignal, For, createResource } from "solid-js";
import { staticProducts } from "~/products";
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function Checkout() {
  const [selectedProduct, setSelectedProduct] = createSignal<string | null>(null);
  const [customer, setCustomer] = createSignal<CustomerForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [dynamicProducts] = createResource(() => fetch("/api/products/dynamic").then(r => r.json()));

  const allProducts = () => [...staticProducts, ...(dynamicProducts() || [])];

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const prodId = selectedProduct();
    if (!prodId) return;

    const cust = customer();
    const checkout = await polar.checkoutLinks.create({
      productId: prodId,
      customerEmail: cust.email,
      customerName: `${cust.firstName} ${cust.lastName}`,
      // Note: Polar may not support phone directly; handle separately if needed
    });

    window.location.href = checkout.url;
  };

  return (
    <div>
      <h1>Checkout</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>First Name:</label>
          <input
            type="text"
            required
            value={customer().firstName}
            onInput={(e) => setCustomer({ ...customer(), firstName: e.target.value })}
          />
        </div>
        <div>
          <label>Last Name:</label>
          <input
            type="text"
            required
            value={customer().lastName}
            onInput={(e) => setCustomer({ ...customer(), lastName: e.target.value })}
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            required
            value={customer().email}
            onInput={(e) => setCustomer({ ...customer(), email: e.target.value })}
          />
        </div>
        <div>
          <label>Phone:</label>
          <input
            type="tel"
            required
            value={customer().phone}
            onInput={(e) => setCustomer({ ...customer(), phone: e.target.value })}
          />
        </div>

        <h2>Select Product</h2>
        <For each={allProducts()}>
          {(product) => (
            <div>
              <input
                type="radio"
                name="product"
                value={product.id}
                onChange={() => setSelectedProduct(product.id)}
              />
              <label>{product.name}</label>
              {product.description && <p>{product.description}</p>}
            </div>
          )}
        </For>

        <button type="submit" disabled={!selectedProduct()}>Buy Now</button>
      </form>
    </div>
  );
}
