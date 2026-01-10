import { PageLayout } from "~/layouts";

export default function Thanks() {
  return (
    <PageLayout title="Thank you" description="Purchase completed successfully">
      <div class="max-w-md mx-auto space-y-6 text-center">
        <h1>Thank you!</h1>

        <div class="space-y-4">
          <p>
            Your purchase has been completed successfully. You should receive a confirmation email
            shortly.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
