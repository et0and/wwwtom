interface SkipLinkProps {
  label?: string;
}

export const SkipLink = (props: SkipLinkProps) => {
  const label = props.label ?? "Skip to main content";

  return (
    <a href="#main" className="skip-link">
      {label}
    </a>
  );
};
