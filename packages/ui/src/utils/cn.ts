import classNames from "classnames";

type ClassValue = string | false | null | undefined | 0 | Record<string, boolean>;

export function cn(...inputs: Array<ClassValue>): string {
  return classNames(...inputs);
}
