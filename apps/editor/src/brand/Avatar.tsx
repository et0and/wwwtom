/** Initials from a display name, falling back to the email prefix. */
export const initialsFor = (name: string | null | undefined, email: string): string => {
  const words = (name ?? "").split(" ").filter((word) => word.length > 0);
  const first = words[0];
  const second = words[1];
  if (first !== undefined && second !== undefined) {
    return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase();
  }
  if (first !== undefined) return first.slice(0, 2).toUpperCase();
  const prefix = email.split("@")[0] ?? "";
  return prefix.slice(0, 2).toUpperCase();
};

/** Circle avatar with the user's initials. */
export const Avatar = (props: { name: string | null | undefined; email: string }) => (
  <span class="avatar" role="img" aria-label={props.name ?? props.email}>
    {initialsFor(props.name, props.email)}
  </span>
);
