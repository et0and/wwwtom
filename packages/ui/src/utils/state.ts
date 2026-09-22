import { createSignal, untrack, type Accessor } from "solid-js";

export interface ControllableSignalOptions<T> {
  value?: (() => T | undefined) | undefined;
  defaultValue?: T | undefined;
  onChange?: ((value: T) => void) | undefined;
}

export interface ControllableSignal<T> {
  value: Accessor<T | undefined>;
  set: (value: T) => void;
  update: (updater: (prev: T | undefined) => T) => void;
}

export function createControllableSignal<T>(
  options: ControllableSignalOptions<T>,
): ControllableSignal<T> {
  const [internal, setInternal] = createSignal<T | undefined>(options.defaultValue as never);

  const isControlled = () => options.value?.() !== undefined;

  const value = (): T | undefined => {
    const controlled = options.value?.();
    return controlled !== undefined ? controlled : internal();
  };

  const commit = (resolved: T): void => {
    const prev = untrack(value);
    if (Object.is(resolved, prev)) return;
    if (!isControlled()) setInternal(() => resolved);
    options.onChange?.(resolved);
  };

  return {
    value,
    set: commit,
    update: (updater) => commit(updater(untrack(value))),
  };
}

export interface ControllableBooleanSignal {
  value: Accessor<boolean>;
  set: (value: boolean) => void;
  update: (updater: (prev: boolean) => boolean) => void;
}

export function createControllableBooleanSignal(
  options: ControllableSignalOptions<boolean>,
): ControllableBooleanSignal {
  const signal = createControllableSignal<boolean>(options);
  return {
    value: () => signal.value() ?? false,
    set: signal.set,
    update: (updater) => signal.update((prev) => updater(prev ?? false)),
  };
}

export interface ToggleStateOptions {
  isSelected?: (() => boolean | undefined) | undefined;
  defaultIsSelected?: boolean | undefined;
  isDisabled?: (() => boolean | undefined) | undefined;
  isReadOnly?: (() => boolean | undefined) | undefined;
  onSelectedChange?: ((isSelected: boolean) => void) | undefined;
}

export interface ToggleState {
  isSelected: Accessor<boolean>;
  setIsSelected: (isSelected: boolean) => void;
  toggle: () => void;
}

export function createToggleState(options: ToggleStateOptions): ToggleState {
  const signal = createControllableBooleanSignal({
    value: options.isSelected,
    defaultValue: options.defaultIsSelected ?? false,
    onChange: options.onSelectedChange,
  });

  const toggle = () => {
    if (options.isDisabled?.() || options.isReadOnly?.()) return;
    signal.update((prev) => !prev);
  };

  return {
    isSelected: signal.value,
    setIsSelected: signal.set,
    toggle,
  };
}

export interface DisclosureStateOptions {
  open?: (() => boolean | undefined) | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((isOpen: boolean) => void) | undefined;
}

export interface DisclosureState {
  isOpen: Accessor<boolean>;
  setIsOpen: (isOpen: boolean) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export function createDisclosureState(options: DisclosureStateOptions): DisclosureState {
  const signal = createControllableBooleanSignal({
    value: options.open,
    defaultValue: options.defaultOpen ?? false,
    onChange: options.onOpenChange,
  });

  return {
    isOpen: signal.value,
    setIsOpen: signal.set,
    open: () => signal.set(true),
    close: () => signal.set(false),
    toggle: () => signal.update((prev) => !prev),
  };
}
