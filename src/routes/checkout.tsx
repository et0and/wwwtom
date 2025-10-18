import { createSignal, For, createResource } from "solid-js";
import { staticProducts } from "~/products";
import { Polar } from "@polar-sh/sdk";
import { customerFormSchema, productSelectionSchema, type CustomerForm } from "~/lib/schemas";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

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
    const cust = customer();

    // Validate form data with Zod
    const customerValidation = customerFormSchema.safeParse(cust);
    if (!customerValidation.success) {
      alert("Please correct the form errors.");
      console.error("Customer validation failed:", customerValidation.error.issues);
      return;
    }

    // Validate product selection
    if (!prodId) {
      alert("Please select a product.");
      return;
    }

    const productValidation = productSelectionSchema.safeParse({ productId: prodId });
    if (!productValidation.success) {
      alert("Invalid product selection.");
      console.error("Product validation failed:", productValidation.error.issues);
      return;
    }

    try {
      const checkout = await polar.checkoutLinks.create({
        productId: prodId,
        customerEmail: customerValidation.data.email,
        customerName: `${customerValidation.data.firstName} ${customerValidation.data.lastName}`,
        // Note: Polar may not support phone directly; handle separately if needed
      });
      window.location.href = checkout.url;
    } catch (error) {
      console.error("Checkout creation failed:", error);
      alert("Failed to create checkout. Please try again.");
    }
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
            maxlength="100"
            value={customer().firstName}
            onInput={(e) => setCustomer({ ...customer(), firstName: e.target.value.trim() })}
          />
        </div>
        <div>
          <label>Last Name:</label>
          <input
            type="text"
            required
            maxlength="100"
            value={customer().lastName}
            onInput={(e) => setCustomer({ ...customer(), lastName: e.target.value.trim() })}
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            required
            maxlength="254"
            value={customer().email}
            onInput={(e) => setCustomer({ ...customer(), email: e.target.value.trim() })}
          />
        </div>
        <div>
          <label>Phone:</label>
          <input
            type="tel"
            required
            pattern="[0-9+\-\s\(\)]*"
            minlength="7"
            maxlength="20"
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
