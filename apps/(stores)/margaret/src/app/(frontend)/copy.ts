export const storefrontCopy = {
  nav: {
    brand: "Grandma Hope",
    shortBrand: "Grandma Hope",
    links: [{ href: "/products", label: "Shop" }],
    skipToContent: "Skip to main content",
  },
  footer: {
    tagline: "Heirloom knitwear and crochet pieces made slowly, by hand, in New Zealand.",

    columns: [
      {
        title: "Browse",
        links: [
          { href: "/", label: "Home" },
          { href: "/products", label: "Shop" },
          { href: "/about", label: "Our story" },
        ],
      },
      {
        title: "Support",
        links: [
          { href: "/products", label: "Shipping & returns" },
          { href: "/success", label: "Order support" },
        ],
      },
    ],
    legal: {
      copyrightLead: "All rights reserved",
      links: [
        { href: "/about", label: "Privacy" },
        { href: "/about", label: "Terms" },
      ],
    },
  },
  home: {
    eyebrow: "Grandma Hope",
    title: "Handmade pieces, crafted patiently one at a time.",
    intro:
      "Grandma Hope creates each piece by hand using traditional techniques and natural yarns, so every item feels personal and made to last.",
    primaryCta: { href: "/products", label: "Shop the collection" },
    secondaryCta: { href: "/about", label: "Read our story" },
    highlights: [
      {
        number: "01",
        title: "Made by hand",
        body: "Each piece is lovingly crafted from scratch by Grandma Hope — every stitch tells a story of patience and care.",
      },
      {
        number: "02",
        title: "Heirloom quality",
        body: "Using traditional techniques and the finest natural yarns, these pieces are made to be treasured for years to come.",
      },
      {
        number: "03",
        title: "One at a time",
        body: "No mass production here. Each item is unique, crafted individually with the warmth only handmade can bring.",
      },
    ],
    noteLabel: "A note from the studio",
    noteBody:
      "If a piece is marked sold out, that handmade run has finished. Grandma Hope restocks in small, careful batches as new pieces are completed.",
  },
  about: {
    eyebrow: "About Grandma Hope",
    title: "A lifetime of craft, stitched into every piece.",
    intro:
      "Grandma Hope began by making for family and neighbors, and it remains intentionally small so every stitch can be finished with care.",
    sections: [
      {
        heading: "How we work",
        body: "Each piece is handmade in short runs. We focus on quality over quantity, finishing every item slowly and thoughtfully.",
      },
      {
        heading: "What matters",
        body: "Natural materials, timeless construction, and pieces that can be worn, gifted, and passed along for years.",
      },
      {
        heading: "Where we ship",
        body: "Orders are packed with care and shipped across New Zealand. If handmade timelines shift, we always communicate clearly.",
      },
    ],
  },
  products: {
    eyebrow: "Current collection",
    title: "Shop Grandma Hope",
    intro:
      "A focused selection of handmade pieces, each crafted one at a time and ready for a new home.",
    emptyState: "No products are available right now. Please check back shortly.",
    pagination: {
      previous: "Previous page",
      next: "Next page",
    },
  },
  productDetail: {
    eyebrow: "Product detail",
    galleryLabel: "Additional product images",
    purchaseHeading: "Ready to order",
    purchaseBody:
      "Checkout is secure and you will receive a confirmation email with delivery details.",
    unavailable: "This item is currently unavailable while the next batch is in progress.",
    submitLabel: "Buy now",
  },
  success: {
    eyebrow: "Order received",
    title: "Thank you — your Grandma Hope order is confirmed.",
    body: "We've received your order and sent a confirmation email. We'll follow up with tracking once your parcel is on its way.",
    cta: { href: "/products", label: "Continue shopping" },
  },
  fallbacks: {
    error: {
      title: "Something went wrong",
      body: "We hit an unexpected issue. Please try again in a moment.",
      retryLabel: "Try again",
      homeLabel: "Return home",
    },
    notFound: {
      title: "Page not found",
      body: "The page you requested is unavailable or may have moved.",
      shopLabel: "Browse products",
    },
  },
} as const;

export type StorefrontCopy = typeof storefrontCopy;
