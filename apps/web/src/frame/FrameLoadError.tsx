import { Banner } from "@tom/ui/banner";

export interface FrameLoadErrorProps {
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
}

export function FrameLoadError(props: FrameLoadErrorProps) {
  return (
    <Banner
      variant="error"
      title={props.title}
      description={props.message}
      action={
        <Banner.Action variant="secondary" onClick={props.onRetry}>
          Retry
        </Banner.Action>
      }
    />
  );
}
