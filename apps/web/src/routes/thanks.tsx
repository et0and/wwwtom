import { PageLayout } from "~/layouts";

export default function Thanks() {
  return (
    <PageLayout title="Thank You" description="Purchase completed successfully">
      <div class="max-w-md mx-auto space-y-6 text-center">
        <h1 class="text-2xl font-bold">Thank You!</h1>

        <div class="space-y-4">
          <p class="text-gray-600">
            Your purchase has been completed successfully. You should receive a confirmation email
            shortly.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
