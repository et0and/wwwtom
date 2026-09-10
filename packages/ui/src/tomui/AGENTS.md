# TomUI

Design rules. Follow always when building or reviewing TomUI.

## Text

- content text 14px. 16px+ headings only.
- headings sentence case. product names title case.
- never `tracking-*`.
- never `font-bold`. headings `font-semibold`. inline bold `font-medium`.
- inline mono `text-[0.9em]`.

## Spacing

- related text tight (`gap-1.5` in `gap-6` group).
- vertical padding smaller than horizontal (`px-5 py-4`, not `p-5`).
- sticky elements get `border-b border-tomui-line`.

## Hover, borders, radius

- no color transitions on hover. hover change immediate.
- no `border` + shadow. use `ring ring-tomui-line`.
- concentric radii: outer = inner + padding.
- never nest `LayerCard` in `LayerCard`.

## Icons

- inline icon same size as text, center on first line.
- wrap: `<span class="h-lh flex items-center"><Icon /></span>`.
- never bare `<Icon />` next to wrapping text.

## Collapse, dialog

- collapse keeps content size while closing. fixed inner width, not `w-full`.
- never conditionally render dialogs. always mount, control with `open`.
