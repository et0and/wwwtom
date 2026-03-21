import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not Found",
};

export default function NotFound() {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1>Not found</h1>
      <p>This admin page does not exist.</p>
    </div>
  );
}
