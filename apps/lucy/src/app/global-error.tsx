"use client";

type Props = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function GlobalError(props: Props) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            fontFamily: "system-ui, sans-serif",
            gap: "16px",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1>Something went wrong</h1>
          <p>{props.error.message || "An unexpected error occurred."}</p>
          <button onClick={props.reset} type="button">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
