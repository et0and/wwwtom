/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY.
 * Regenerate with `pnpm --filter @tom/figma generate:registry`.
 */
import type { RegistryEntry } from "./registry/types";

export const componentRegistry: ReadonlyArray<RegistryEntry> = [
  {
    "name": "Autocomplete",
    "slug": "autocomplete",
    "exportPrefix": "INPUT_SIZE",
    "baseStyles": null,
    "variants": [
      {
        "name": "xs",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "sm",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "base",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "lg",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      }
    ],
    "defaults": {},
    "parts": [
      "input",
      "content",
      "item"
    ]
  },
  {
    "name": "Badge",
    "slug": "badge",
    "exportPrefix": "BADGE",
    "baseStyles": "inline-flex w-fit flex-none shrink-0 items-center justify-self-start gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [a:hover_&]:ring [a:hover_&]:ring-current",
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "primary",
            "classes": "bg-tomui-badge-inverted text-tomui-badge-inverted",
            "description": "Primary badge"
          },
          {
            "name": "secondary",
            "classes": "bg-tomui-fill text-tomui-badge-neutral-subtle",
            "description": "Secondary badge"
          },
          {
            "name": "error",
            "classes": "bg-tomui-danger-tint text-tomui-danger",
            "description": "Error badge"
          },
          {
            "name": "warning",
            "classes": "bg-tomui-warning-tint text-tomui-warning",
            "description": "Warning badge"
          },
          {
            "name": "success",
            "classes": "bg-tomui-success-tint text-tomui-success",
            "description": "Success badge"
          },
          {
            "name": "destructive",
            "classes": "bg-tomui-badge-red text-white",
            "description": "Deprecated. Use red instead."
          },
          {
            "name": "info",
            "classes": "bg-tomui-info-tint text-tomui-info",
            "description": "Info badge"
          },
          {
            "name": "beta",
            "classes": "border border-dashed border-tomui-brand bg-transparent text-tomui-link",
            "description": "Indicates beta or experimental features"
          },
          {
            "name": "outline",
            "classes": "border border-tomui-fill bg-tomui-base text-tomui-default",
            "description": "Bordered badge with base background"
          },
          {
            "name": "red",
            "classes": "bg-tomui-badge-red text-white",
            "description": "Red badge"
          },
          {
            "name": "green",
            "classes": "bg-tomui-badge-green text-white",
            "description": "Green badge"
          },
          {
            "name": "neutral",
            "classes": "bg-tomui-badge-neutral text-white",
            "description": "Neutral badge"
          },
          {
            "name": "orange",
            "classes": "bg-tomui-badge-orange text-black",
            "description": "Orange badge"
          },
          {
            "name": "purple",
            "classes": "bg-tomui-badge-purple text-white",
            "description": "Purple badge"
          },
          {
            "name": "teal",
            "classes": "bg-tomui-badge-teal text-white",
            "description": "Teal badge"
          },
          {
            "name": "teal-subtle",
            "classes": "bg-tomui-fill text-tomui-badge-teal-subtle",
            "description": "Subtle teal badge"
          },
          {
            "name": "blue",
            "classes": "bg-tomui-badge-blue text-white",
            "description": "Blue badge"
          }
        ]
      },
      {
        "name": "appearance",
        "values": [
          {
            "name": "filled",
            "classes": "",
            "description": "Filled badge with background color (default)"
          },
          {
            "name": "dot",
            "classes": "gap-1.5 bg-transparent text-tomui-default ring ring-tomui-hairline",
            "description": "Outlined badge with a colored circle dot"
          }
        ]
      },
      {
        "name": "dotColor",
        "values": [
          {
            "name": "none",
            "classes": "",
            "description": "No dot indicator"
          },
          {
            "name": "success",
            "classes": "bg-tomui-success",
            "description": "Green dot for success status"
          },
          {
            "name": "warning",
            "classes": "bg-tomui-badge-orange",
            "description": "Orange dot for warning status"
          },
          {
            "name": "error",
            "classes": "bg-tomui-badge-red",
            "description": "Red dot for error status"
          },
          {
            "name": "neutral",
            "classes": "bg-tomui-badge-neutral",
            "description": "Neutral dot for informational status"
          }
        ]
      }
    ],
    "defaults": {
      "variant": "primary",
      "appearance": "filled",
      "dotColor": "none"
    },
    "parts": []
  },
  {
    "name": "Banner",
    "slug": "banner",
    "exportPrefix": "BANNER",
    "baseStyles": "flex w-full",
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "bg-tomui-info-tint text-tomui-info",
            "description": "Informational banner for general messages"
          },
          {
            "name": "alert",
            "classes": "bg-tomui-warning-tint text-tomui-warning",
            "description": "Warning banner for cautionary messages"
          },
          {
            "name": "error",
            "classes": "bg-tomui-danger-tint text-tomui-danger",
            "description": "Error banner for critical issues"
          },
          {
            "name": "secondary",
            "classes": "bg-tomui-contrast/5 text-tomui-default/70",
            "description": "Neutral banner for secondary messages"
          }
        ]
      },
      {
        "name": "size",
        "values": [
          {
            "name": "base",
            "classes": "items-start gap-3 rounded-lg px-4 py-3 text-base",
            "description": "Default banner size"
          },
          {
            "name": "sm",
            "classes": "items-center gap-2 rounded-md px-3 py-2 text-sm",
            "description": "Compact banner for dialogs and tight spaces"
          }
        ]
      }
    ],
    "defaults": {
      "variant": "default",
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Breadcrumbs",
    "slug": "breadcrumbs",
    "exportPrefix": "BREADCRUMBS",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "sm",
            "classes": "text-sm h-10 gap-0.5",
            "description": "Compact breadcrumbs for dense UIs"
          },
          {
            "name": "base",
            "classes": "text-base h-12 gap-1",
            "description": "Default breadcrumbs size"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Button",
    "slug": "button",
    "exportPrefix": "BUTTON",
    "baseStyles": null,
    "variants": [
      {
        "name": "form",
        "values": [
          {
            "name": "base",
            "classes": "",
            "description": "Default rectangular button form"
          },
          {
            "name": "square",
            "classes": "items-center justify-center p-0",
            "description": "Square button for icon-only actions"
          },
          {
            "name": "circle",
            "classes": "items-center justify-center p-0 rounded-full",
            "description": "Circular button for icon-only actions"
          }
        ]
      },
      {
        "name": "size",
        "values": [
          {
            "name": "xs",
            "classes": "h-5 gap-1 rounded-sm px-1.5 text-xs",
            "description": "Extra small button for compact UIs"
          },
          {
            "name": "sm",
            "classes": "h-6.5 gap-1 rounded-md px-2 text-xs",
            "description": "Small button for secondary actions"
          },
          {
            "name": "base",
            "classes": "h-9 gap-1.5 rounded-lg px-3 text-base",
            "description": "Default button size"
          },
          {
            "name": "lg",
            "classes": "h-10 gap-2 rounded-lg px-4 text-base",
            "description": "Large button for primary CTAs"
          }
        ]
      },
      {
        "name": "compactSize",
        "values": [
          {
            "name": "xs",
            "classes": "size-3.5",
            "description": null
          },
          {
            "name": "sm",
            "classes": "size-6.5",
            "description": null
          },
          {
            "name": "base",
            "classes": "size-9",
            "description": null
          },
          {
            "name": "lg",
            "classes": "size-10",
            "description": null
          }
        ]
      },
      {
        "name": "variant",
        "values": [
          {
            "name": "primary",
            "classes": "relative overflow-hidden bg-(--tomui-button-emphasis-bg) !text-white ring ring-(--tomui-button-emphasis-ring) focus:ring-(--tomui-button-emphasis-ring) focus-visible:ring-(--tomui-button-emphasis-ring) active:ring-(--tomui-button-emphasis-ring) disabled:opacity-50",
            "description": "High-emphasis button for primary actions"
          },
          {
            "name": "secondary",
            "classes": "bg-tomui-base !text-tomui-default ring not-disabled:hover:bg-tomui-tint disabled:bg-tomui-base/50 disabled:!text-tomui-default/70 ring-tomui-line data-[state=open]:bg-tomui-base",
            "description": "Default button style for most actions"
          },
          {
            "name": "ghost",
            "classes": "text-tomui-default hover:bg-tomui-tint shadow-none bg-inherit",
            "description": "Minimal button with no background"
          },
          {
            "name": "destructive",
            "classes": "relative overflow-hidden bg-(--tomui-button-emphasis-bg) !text-white ring ring-(--tomui-button-emphasis-ring) focus:ring-(--tomui-button-emphasis-ring) focus-visible:ring-(--tomui-button-emphasis-ring) active:ring-(--tomui-button-emphasis-ring) disabled:opacity-50",
            "description": "Danger button for destructive actions like delete"
          },
          {
            "name": "secondary-destructive",
            "classes": "bg-tomui-base !text-tomui-danger ring not-disabled:hover:!text-tomui-danger not-disabled:hover:ring-tomui-danger/30 disabled:bg-tomui-base/50 disabled:!text-tomui-danger/70 ring-tomui-line data-[state=open]:bg-tomui-base",
            "description": "Secondary button with destructive text"
          },
          {
            "name": "outline",
            "classes": "bg-transparent text-tomui-default ring ring-tomui-line transition-colors not-disabled:hover:text-tomui-strong not-disabled:hover:ring-tomui-focus/25",
            "description": "Bordered button with transparent background"
          }
        ]
      }
    ],
    "defaults": {
      "form": "base",
      "size": "base",
      "variant": "secondary"
    },
    "parts": []
  },
  {
    "name": "Chart",
    "slug": "chart",
    "exportPrefix": "CHART",
    "baseStyles": null,
    "variants": [
      {
        "name": "type",
        "values": [
          {
            "name": "line",
            "classes": "",
            "description": "Line chart rendered as SVG polyline"
          },
          {
            "name": "bar",
            "classes": "",
            "description": "Bar chart rendered as SVG rects"
          },
          {
            "name": "sparkline",
            "classes": "",
            "description": "Compact sparkline without axes"
          },
          {
            "name": "timeseries",
            "classes": "",
            "description": "Timeseries line with time labels"
          }
        ]
      },
      {
        "name": "size",
        "values": [
          {
            "name": "sm",
            "classes": "h-16",
            "description": "Small compact chart"
          },
          {
            "name": "base",
            "classes": "h-40",
            "description": "Default chart height"
          },
          {
            "name": "lg",
            "classes": "h-64",
            "description": "Large chart height"
          }
        ]
      }
    ],
    "defaults": {
      "type": "line",
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Checkbox",
    "slug": "checkbox",
    "exportPrefix": "CHECKBOX",
    "baseStyles": null,
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "[&:focus-within>span]:ring-tomui-focus [&:hover>span]:ring-tomui-hairline",
            "description": "Default checkbox appearance"
          },
          {
            "name": "error",
            "classes": "[&>span]:ring-tomui-danger",
            "description": "Error state for validation failures"
          }
        ]
      }
    ],
    "defaults": {
      "variant": "default"
    },
    "parts": [
      "item-label"
    ]
  },
  {
    "name": "ClipboardText",
    "slug": "clipboard-text",
    "exportPrefix": "CLIPBOARD_TEXT",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "sm",
            "classes": "text-xs",
            "description": "Small clipboard text for compact UIs"
          },
          {
            "name": "base",
            "classes": "text-sm",
            "description": "Default clipboard text size"
          },
          {
            "name": "lg",
            "classes": "text-sm",
            "description": "Large clipboard text for prominent display"
          }
        ]
      }
    ],
    "defaults": {
      "size": "lg"
    },
    "parts": []
  },
  {
    "name": "Code",
    "slug": "code",
    "exportPrefix": "CODE",
    "baseStyles": null,
    "variants": [
      {
        "name": "lang",
        "values": [
          {
            "name": "ts",
            "classes": "",
            "description": "TypeScript code"
          },
          {
            "name": "tsx",
            "classes": "",
            "description": "TypeScript JSX code"
          },
          {
            "name": "jsonc",
            "classes": "",
            "description": "JSON with comments"
          },
          {
            "name": "bash",
            "classes": "",
            "description": "Shell/Bash commands"
          },
          {
            "name": "css",
            "classes": "",
            "description": "CSS styles"
          }
        ]
      }
    ],
    "defaults": {
      "lang": "ts"
    },
    "parts": []
  },
  {
    "name": "Collapsible",
    "slug": "collapsible",
    "exportPrefix": "",
    "baseStyles": null,
    "variants": [],
    "defaults": {},
    "parts": [
      "trigger",
      "panel",
      "default-trigger"
    ]
  },
  {
    "name": "Combobox",
    "slug": "combobox",
    "exportPrefix": "COMBOBOX",
    "baseStyles": null,
    "variants": [
      {
        "name": "inputSide",
        "values": [
          {
            "name": "right",
            "classes": "",
            "description": "Input positioned inline to the right of chips"
          },
          {
            "name": "top",
            "classes": "",
            "description": "Input positioned above chips"
          }
        ]
      }
    ],
    "defaults": {
      "inputSide": "right"
    },
    "parts": [
      "content",
      "input",
      "clear",
      "trigger",
      "item",
      "chip-remove"
    ]
  },
  {
    "name": "CommandPaletteBackdrop",
    "slug": "command-palette",
    "exportPrefix": "COMMAND_PALETTE",
    "baseStyles": null,
    "variants": [
      {
        "name": "root",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "input",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "list",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "item",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      }
    ],
    "defaults": {},
    "parts": []
  },
  {
    "name": "DatePicker",
    "slug": "date-picker",
    "exportPrefix": "DATE_PICKER",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "xs",
            "classes": "h-5 px-1.5 text-xs",
            "description": "Extra small date input for compact UIs"
          },
          {
            "name": "sm",
            "classes": "h-6.5 px-2 text-xs",
            "description": "Small date input for secondary fields"
          },
          {
            "name": "base",
            "classes": "h-9 px-3 text-base",
            "description": "Default date input size"
          },
          {
            "name": "lg",
            "classes": "h-10 px-4 text-base",
            "description": "Large date input for prominent fields"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "DateRangePicker",
    "slug": "date-range-picker",
    "exportPrefix": "DATE_RANGE_PICKER",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "sm",
            "classes": "p-3 gap-2",
            "description": "Compact range picker for tight spaces"
          },
          {
            "name": "base",
            "classes": "p-4 gap-2.5",
            "description": "Default range picker size"
          },
          {
            "name": "lg",
            "classes": "p-5 gap-3",
            "description": "Large range picker for prominent date selection"
          }
        ]
      },
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "bg-tomui-overlay",
            "description": "Default range picker appearance"
          },
          {
            "name": "subtle",
            "classes": "bg-tomui-base",
            "description": "Subtle range picker with minimal background"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base",
      "variant": "default"
    },
    "parts": []
  },
  {
    "name": "Dialog",
    "slug": "dialog",
    "exportPrefix": "DIALOG",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "base",
            "classes": "sm:w-96",
            "description": "Default dialog width (384px)"
          },
          {
            "name": "sm",
            "classes": "sm:w-72",
            "description": "Small dialog for simple confirmations (288px)"
          },
          {
            "name": "lg",
            "classes": "sm:w-[32rem]",
            "description": "Large dialog for complex content (512px)"
          },
          {
            "name": "xl",
            "classes": "sm:w-[48rem]",
            "description": "Extra large dialog for detailed views (768px)"
          }
        ]
      },
      {
        "name": "role",
        "values": [
          {
            "name": "dialog",
            "classes": "",
            "description": "Standard dialog for general-purpose modals"
          },
          {
            "name": "alertdialog",
            "classes": "",
            "description": "Alert dialog for confirmation flows requiring explicit user acknowledgment"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base",
      "role": "dialog"
    },
    "parts": [
      "trigger",
      "backdrop",
      "title",
      "description",
      "close"
    ]
  },
  {
    "name": "DropdownMenu",
    "slug": "dropdown",
    "exportPrefix": "DROPDOWN",
    "baseStyles": null,
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "",
            "description": "Default dropdown item appearance"
          },
          {
            "name": "danger",
            "classes": "text-tomui-danger data-highlighted:bg-tomui-danger/5 data-highlighted:text-tomui-danger",
            "description": "Destructive action item"
          }
        ]
      }
    ],
    "defaults": {
      "variant": "default"
    },
    "parts": [
      "trigger",
      "content",
      "item",
      "checkbox-item",
      "radio-item"
    ]
  },
  {
    "name": "Empty",
    "slug": "empty",
    "exportPrefix": "EMPTY",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "sm",
            "classes": "px-6 py-8 gap-4",
            "description": "Compact empty state for smaller containers"
          },
          {
            "name": "base",
            "classes": "px-10 py-16 gap-6",
            "description": "Default empty state size"
          },
          {
            "name": "lg",
            "classes": "px-12 py-20 gap-8",
            "description": "Large empty state for prominent placement"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Field",
    "slug": "field",
    "exportPrefix": "",
    "baseStyles": null,
    "variants": [],
    "defaults": {},
    "parts": []
  },
  {
    "name": "FlowNode",
    "slug": "flow",
    "exportPrefix": "FLOW",
    "baseStyles": null,
    "variants": [
      {
        "name": "orientation",
        "values": [
          {
            "name": "horizontal",
            "classes": "flex-row",
            "description": "Nodes progress left-to-right"
          },
          {
            "name": "vertical",
            "classes": "flex-col",
            "description": "Nodes progress top-to-bottom"
          }
        ]
      },
      {
        "name": "align",
        "values": [
          {
            "name": "start",
            "classes": "items-start",
            "description": "Nodes align to the start edge"
          },
          {
            "name": "center",
            "classes": "items-center",
            "description": "Nodes centered across the inactive axis"
          }
        ]
      }
    ],
    "defaults": {
      "align": "start",
      "orientation": "vertical"
    },
    "parts": []
  },
  {
    "name": "Grid",
    "slug": "grid",
    "exportPrefix": "GRID",
    "baseStyles": null,
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "2up",
            "classes": "grid-cols-1 md:grid-cols-2",
            "description": "Grid items stack on small screens, display side-by-side on medium screens and up"
          },
          {
            "name": "side-by-side",
            "classes": "grid-cols-2",
            "description": "Grid items always displayed side-by-side"
          },
          {
            "name": "2-1",
            "classes": "grid-cols-1 md:grid-cols-[2fr_1fr]",
            "description": "Two-thirds / one-third split (66%/33%) on medium screens and up"
          },
          {
            "name": "1-2",
            "classes": "grid-cols-1 md:grid-cols-[1fr_2fr]",
            "description": "One-third / two-thirds split (33%/66%) on medium screens and up"
          },
          {
            "name": "1-3up",
            "classes": "grid-cols-1 lg:grid-cols-3",
            "description": "Grid items stack on small screens, expand to 3 across on large screens"
          },
          {
            "name": "3up",
            "classes": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
            "description": "Grid items stack on small screens, 2 across on medium, 3 across on large"
          },
          {
            "name": "4up",
            "classes": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            "description": "Grid items stack on small screens, progressively increase columns at larger breakpoints"
          },
          {
            "name": "6up",
            "classes": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
            "description": "Grid items start at 2 across, expand to 6 across on XL"
          },
          {
            "name": "1-2-4up",
            "classes": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
            "description": "Grid items stack on small screens, 2 across on medium, 4 across on large"
          }
        ]
      },
      {
        "name": "gap",
        "values": [
          {
            "name": "none",
            "classes": "gap-0",
            "description": "No gap between grid items"
          },
          {
            "name": "sm",
            "classes": "gap-3",
            "description": "Small gap between grid items"
          },
          {
            "name": "base",
            "classes": "gap-2 md:gap-6 lg:gap-8",
            "description": "Default responsive gap between grid items"
          },
          {
            "name": "lg",
            "classes": "gap-8",
            "description": "Large gap between grid items"
          }
        ]
      }
    ],
    "defaults": {
      "gap": "base"
    },
    "parts": []
  },
  {
    "name": "Input",
    "slug": "input",
    "exportPrefix": "INPUT",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "xs",
            "classes": "h-5 gap-1 rounded-sm px-1.5 text-xs",
            "description": "Extra small input for compact UIs"
          },
          {
            "name": "sm",
            "classes": "h-6.5 gap-1 rounded-md px-2 text-xs",
            "description": "Small input for secondary fields"
          },
          {
            "name": "base",
            "classes": "h-9 gap-1.5 rounded-lg px-3 text-base",
            "description": "Default input size"
          },
          {
            "name": "lg",
            "classes": "h-10 gap-2 rounded-lg px-4 text-base",
            "description": "Large input for prominent fields"
          }
        ]
      },
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "focus:ring-tomui-focus/50 focus:ring-[1.5px]",
            "description": "Default input appearance"
          },
          {
            "name": "error",
            "classes": "!ring-tomui-danger focus:ring-tomui-danger/50 focus:ring-[1.5px]",
            "description": "Error state for validation failures"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base",
      "variant": "default"
    },
    "parts": []
  },
  {
    "name": "InputGroup",
    "slug": "input-group",
    "exportPrefix": "INPUT_GROUP",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "xs",
            "classes": "h-6 text-xs",
            "description": "Extra small size."
          },
          {
            "name": "sm",
            "classes": "h-7 text-xs",
            "description": "Small size."
          },
          {
            "name": "base",
            "classes": "h-9 text-base",
            "description": "Default size."
          },
          {
            "name": "lg",
            "classes": "h-11 text-base",
            "description": "Large size."
          }
        ]
      }
    ],
    "defaults": {
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Label",
    "slug": "label",
    "exportPrefix": "",
    "baseStyles": null,
    "variants": [],
    "defaults": {},
    "parts": []
  },
  {
    "name": "LayerCard",
    "slug": "layer-card",
    "exportPrefix": "LAYER_CARD",
    "baseStyles": null,
    "variants": [],
    "defaults": {},
    "parts": []
  },
  {
    "name": "Link",
    "slug": "link",
    "exportPrefix": "LINK",
    "baseStyles": null,
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "inline",
            "classes": "text-tomui-link underline underline-offset-[0.15em] decoration-[0.0625em] link-current transition-colors",
            "description": "Inline text link that flows with content"
          },
          {
            "name": "current",
            "classes": "text-current underline underline-offset-[0.15em] decoration-[0.0625em] link-current transition-colors",
            "description": "Link that inherits color from parent text"
          },
          {
            "name": "plain",
            "classes": "text-tomui-link hover:text-tomui-link/70 transition-colors",
            "description": "Link without underline decoration"
          }
        ]
      }
    ],
    "defaults": {
      "variant": "inline"
    },
    "parts": []
  },
  {
    "name": "Loader",
    "slug": "loader",
    "exportPrefix": "LOADER",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "sm",
            "classes": "",
            "description": "Small loader for inline use"
          },
          {
            "name": "base",
            "classes": "",
            "description": "Default loader size"
          },
          {
            "name": "lg",
            "classes": "",
            "description": "Large loader for prominent loading states"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Meter",
    "slug": "meter",
    "exportPrefix": "",
    "baseStyles": null,
    "variants": [],
    "defaults": {},
    "parts": []
  },
  {
    "name": "Pagination",
    "slug": "pagination",
    "exportPrefix": "PAGINATION",
    "baseStyles": null,
    "variants": [
      {
        "name": "controls",
        "values": [
          {
            "name": "full",
            "classes": "",
            "description": "Full pagination controls with first, previous, pages, next, and last buttons"
          },
          {
            "name": "simple",
            "classes": "",
            "description": "Simple pagination controls with only previous and next buttons"
          }
        ]
      }
    ],
    "defaults": {
      "controls": "full"
    },
    "parts": []
  },
  {
    "name": "Popover",
    "slug": "popover",
    "exportPrefix": "POPOVER",
    "baseStyles": null,
    "variants": [
      {
        "name": "side",
        "values": [
          {
            "name": "top",
            "classes": "",
            "description": "Popover appears above the trigger"
          },
          {
            "name": "bottom",
            "classes": "",
            "description": "Popover appears below the trigger"
          },
          {
            "name": "left",
            "classes": "",
            "description": "Popover appears to the left of the trigger"
          },
          {
            "name": "right",
            "classes": "",
            "description": "Popover appears to the right of the trigger"
          }
        ]
      }
    ],
    "defaults": {
      "side": "bottom"
    },
    "parts": [
      "trigger",
      "content",
      "title",
      "description",
      "close"
    ]
  },
  {
    "name": "Radio",
    "slug": "radio",
    "exportPrefix": "RADIO",
    "baseStyles": null,
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "ring-tomui-hairline",
            "description": "Default radio appearance"
          },
          {
            "name": "error",
            "classes": "ring-tomui-danger",
            "description": "Error state for validation failures"
          }
        ]
      },
      {
        "name": "appearance",
        "values": [
          {
            "name": "default",
            "classes": "",
            "description": "Standard inline radio item"
          },
          {
            "name": "card",
            "classes": "rounded-lg border border-tomui-hairline bg-tomui-base p-3 transition-colors hover:bg-tomui-tint has-[[data-checked]]:border-tomui-interact has-[[data-checked]]:bg-tomui-tint",
            "description": "Choice card appearance with border, padding, and highlighted selection state"
          }
        ]
      }
    ],
    "defaults": {},
    "parts": [
      "item-label",
      "item"
    ]
  },
  {
    "name": "Select",
    "slug": "select",
    "exportPrefix": "SELECT",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "xs",
            "classes": "h-5 gap-1 rounded-sm px-1.5 text-xs",
            "description": "Extra small select for compact UIs"
          },
          {
            "name": "sm",
            "classes": "h-6.5 gap-1 rounded-md px-2 text-xs",
            "description": "Small select for secondary fields"
          },
          {
            "name": "base",
            "classes": "h-9 gap-1.5 rounded-lg px-3 text-base",
            "description": "Default select size"
          },
          {
            "name": "lg",
            "classes": "h-10 gap-2 rounded-lg px-4 text-base",
            "description": "Large select for prominent fields"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "SensitiveInput",
    "slug": "sensitive-input",
    "exportPrefix": "SENSITIVE_INPUT",
    "baseStyles": null,
    "variants": [],
    "defaults": {
      "size": "base",
      "variant": "default"
    },
    "parts": [
      "toggle-visibility",
      "copy"
    ]
  },
  {
    "name": "SidebarSection",
    "slug": "sidebar",
    "exportPrefix": "SIDEBAR",
    "baseStyles": null,
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "sidebar",
            "classes": "",
            "description": "Standard sidebar with border separator"
          },
          {
            "name": "floating",
            "classes": "",
            "description": "Floating sidebar with shadow and rounded corners"
          },
          {
            "name": "inset",
            "classes": "",
            "description": "Inset sidebar within the content area"
          }
        ]
      },
      {
        "name": "collapsible",
        "values": [
          {
            "name": "icon",
            "classes": "",
            "description": "Collapses to show icons only"
          },
          {
            "name": "offcanvas",
            "classes": "",
            "description": "Slides off screen when collapsed"
          },
          {
            "name": "none",
            "classes": "",
            "description": "Cannot be collapsed"
          }
        ]
      },
      {
        "name": "side",
        "values": [
          {
            "name": "left",
            "classes": "",
            "description": "Left-aligned sidebar"
          },
          {
            "name": "right",
            "classes": "",
            "description": "Right-aligned sidebar"
          }
        ]
      }
    ],
    "defaults": {
      "collapsible": "icon",
      "side": "left",
      "variant": "sidebar"
    },
    "parts": []
  },
  {
    "name": "Switch",
    "slug": "switch",
    "exportPrefix": "SWITCH",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "sm",
            "classes": "h-5.5 w-8.5",
            "description": "Small switch for compact UIs"
          },
          {
            "name": "base",
            "classes": "h-6.5 w-10.5",
            "description": "Default switch size"
          },
          {
            "name": "lg",
            "classes": "h-7.5 w-12.5",
            "description": "Large switch for prominent toggles"
          }
        ]
      },
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "",
            "description": "Default switch with squircle shape and brand blue color"
          },
          {
            "name": "neutral",
            "classes": "",
            "description": "Monochrome switch with squircle shape for subtle toggles"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base",
      "variant": "default"
    },
    "parts": [
      "item-label"
    ]
  },
  {
    "name": "Table",
    "slug": "table",
    "exportPrefix": "TABLE",
    "baseStyles": null,
    "variants": [
      {
        "name": "layout",
        "values": [
          {
            "name": "auto",
            "classes": "",
            "description": "Auto table layout - columns resize based on content"
          },
          {
            "name": "fixed",
            "classes": "table-fixed",
            "description": "Fixed table layout - equal-width columns"
          }
        ]
      },
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "even:bg-tomui-elevated [--tomui-table-row-bg:var(--color-tomui-base)] even:[--tomui-table-row-bg:var(--color-tomui-elevated)]",
            "description": "Default row variant"
          },
          {
            "name": "selected",
            "classes": "bg-tomui-tint [--tomui-table-row-bg:var(--color-tomui-tint)]",
            "description": "Selected row variant"
          }
        ]
      },
      {
        "name": "sticky",
        "values": [
          {
            "name": "left",
            "classes": "sticky left-0",
            "description": "Pin column to the left edge of the scroll container"
          },
          {
            "name": "right",
            "classes": "sticky right-0",
            "description": "Pin column to the right edge of the scroll container"
          }
        ]
      }
    ],
    "defaults": {
      "layout": "auto",
      "variant": "default"
    },
    "parts": []
  },
  {
    "name": "TableOfContents",
    "slug": "table-of-contents",
    "exportPrefix": "TABLE_OF_CONTENTS",
    "baseStyles": null,
    "variants": [
      {
        "name": "state",
        "values": [
          {
            "name": "default",
            "classes": "text-tomui-subtle hover:border-tomui-line hover:text-tomui-default hover:font-medium",
            "description": "Inactive section link"
          },
          {
            "name": "active",
            "classes": "border-tomui-brand font-medium text-tomui-default",
            "description": "Currently visible / active section"
          }
        ]
      }
    ],
    "defaults": {
      "state": "default"
    },
    "parts": []
  },
  {
    "name": "Tabs",
    "slug": "tabs",
    "exportPrefix": "TABS",
    "baseStyles": null,
    "variants": [],
    "defaults": {
      "variant": "segmented",
      "size": "base"
    },
    "parts": [
      "tab",
      "panel"
    ]
  },
  {
    "name": "Text",
    "slug": "text",
    "exportPrefix": "TEXT",
    "baseStyles": null,
    "variants": [
      {
        "name": "variant",
        "values": [
          {
            "name": "heading",
            "classes": "text-lg font-semibold",
            "description": "Heading text (16px by default, 20px at large size)"
          },
          {
            "name": "heading1",
            "classes": "text-3xl font-semibold",
            "description": "Deprecated large heading for page titles; use heading instead"
          },
          {
            "name": "heading2",
            "classes": "text-2xl font-semibold",
            "description": "Deprecated medium heading for section titles; use heading instead"
          },
          {
            "name": "heading3",
            "classes": "text-lg font-semibold",
            "description": "Deprecated small heading for subsections; use heading instead"
          },
          {
            "name": "body",
            "classes": "text-tomui-default",
            "description": "Default body text"
          },
          {
            "name": "secondary",
            "classes": "text-tomui-subtle",
            "description": "Muted text for secondary information"
          },
          {
            "name": "success",
            "classes": "text-tomui-link",
            "description": "Success state text in link color"
          },
          {
            "name": "error",
            "classes": "text-tomui-danger",
            "description": "Error state text"
          },
          {
            "name": "mono",
            "classes": "font-mono",
            "description": "Monospace text for code"
          },
          {
            "name": "mono-secondary",
            "classes": "font-mono text-tomui-subtle",
            "description": "Muted monospace text"
          }
        ]
      },
      {
        "name": "size",
        "values": [
          {
            "name": "xs",
            "classes": "text-xs/[inherit]",
            "description": "Extra small text"
          },
          {
            "name": "sm",
            "classes": "text-sm/[inherit]",
            "description": "Small text"
          },
          {
            "name": "base",
            "classes": "text-base/[inherit]",
            "description": "Default text size"
          },
          {
            "name": "lg",
            "classes": "text-lg/[inherit]",
            "description": "Large text"
          }
        ]
      }
    ],
    "defaults": {
      "variant": "body",
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Toaster",
    "slug": "toast",
    "exportPrefix": "TOAST",
    "baseStyles": null,
    "variants": [
      {
        "name": "root",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "title",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "description",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "close",
        "values": [
          {
            "name": "classes",
            "classes": "",
            "description": null
          },
          {
            "name": "description",
            "classes": "",
            "description": null
          }
        ]
      },
      {
        "name": "variant",
        "values": [
          {
            "name": "default",
            "classes": "border-tomui-fill bg-tomui-base",
            "description": "Default toast style"
          },
          {
            "name": "success",
            "classes": "ring-[0.3px] ring-tomui-success bg-tomui-base [&_[data-toast-icon]]:text-tomui-success [&_[data-toast-title]]:text-tomui-success",
            "description": "Success toast for confirmations and positive outcomes"
          },
          {
            "name": "error",
            "classes": "ring-[0.3px] ring-tomui-danger bg-tomui-base [&_[data-toast-icon]]:text-tomui-danger [&_[data-toast-title]]:text-tomui-danger",
            "description": "Error toast for critical issues"
          },
          {
            "name": "warning",
            "classes": "ring-[0.3px] ring-tomui-warning bg-tomui-base [&_[data-toast-icon]]:text-tomui-warning [&_[data-toast-title]]:text-tomui-warning",
            "description": "Warning toast for cautionary messages"
          },
          {
            "name": "info",
            "classes": "ring-[0.3px] ring-tomui-info bg-tomui-control [&_[data-toast-icon]]:text-tomui-info [&_[data-toast-title]]:text-tomui-info",
            "description": "Info toast for neutral informational messages"
          }
        ]
      }
    ],
    "defaults": {
      "variant": "default"
    },
    "parts": []
  },
  {
    "name": "Toolbar",
    "slug": "toolbar",
    "exportPrefix": "TOOLBAR",
    "baseStyles": null,
    "variants": [
      {
        "name": "size",
        "values": [
          {
            "name": "xs",
            "classes": "text-xs",
            "description": "Extra small toolbar for compact UIs"
          },
          {
            "name": "sm",
            "classes": "text-xs",
            "description": "Small toolbar for secondary controls"
          },
          {
            "name": "base",
            "classes": "text-base",
            "description": "Default toolbar size"
          },
          {
            "name": "lg",
            "classes": "text-base",
            "description": "Large toolbar for prominent controls"
          }
        ]
      }
    ],
    "defaults": {
      "size": "base"
    },
    "parts": []
  },
  {
    "name": "Tooltip",
    "slug": "tooltip",
    "exportPrefix": "TOOLTIP",
    "baseStyles": null,
    "variants": [
      {
        "name": "side",
        "values": [
          {
            "name": "top",
            "classes": "",
            "description": "Tooltip appears above the trigger"
          },
          {
            "name": "bottom",
            "classes": "",
            "description": "Tooltip appears below the trigger"
          },
          {
            "name": "left",
            "classes": "",
            "description": "Tooltip appears to the left of the trigger"
          },
          {
            "name": "right",
            "classes": "",
            "description": "Tooltip appears to the right of the trigger"
          }
        ]
      }
    ],
    "defaults": {
      "side": "top"
    },
    "parts": []
  }
];
