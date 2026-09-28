import type { RegistryEntry } from "../registry/types";
import { anatomyFor, type Anatomy, type AnatomyNode, type AnatomyRole } from "./anatomy";
import { resolveStyleList, type ResolvedStyle } from "./parse-classes";

export type Axis = { readonly group: string; readonly values: ReadonlyArray<string> };

/** A fully resolved node tree, independent of the Figma runtime. */
export type PlannedNode = {
  readonly role: AnatomyRole;
  readonly kind: AnatomyNode["kind"];
  readonly text: string | null;
  readonly style: ResolvedStyle;
  readonly children: ReadonlyArray<PlannedNode>;
};

export type PlannedComponent = {
  readonly name: string;
  readonly root: PlannedNode;
};

/** Above this many variants we trim axes, largest values first. */
const MAX_VARIANTS = 60;

export function buildAxes(entry: RegistryEntry): ReadonlyArray<Axis> {
  const candidates: Array<Axis> = [];
  for (const group of entry.variants) {
    if (group.name === "compactSize") continue;
    const values = group.values.filter((value) => value.classes.trim().length > 0);
    if (values.length >= 2) {
      candidates.push({ group: group.name, values: values.map((value) => value.name) });
    }
  }
  candidates.sort((left, right) => left.values.length - right.values.length);
  const axes: Array<Axis> = [];
  let count = 1;
  for (const candidate of candidates) {
    const limit = Math.max(1, Math.floor(MAX_VARIANTS / count));
    const values = candidate.values.slice(0, Math.min(candidate.values.length, limit));
    if (values.length < 2) continue;
    axes.push({ group: candidate.group, values });
    count *= values.length;
  }
  return axes;
}

export function buildSelections(axes: ReadonlyArray<Axis>): ReadonlyArray<Map<string, string>> {
  let result: Array<Map<string, string>> = [new Map()];
  for (const axis of axes) {
    const next: Array<Map<string, string>> = [];
    for (const partial of result) {
      for (const value of axis.values) {
        const selection = new Map(partial);
        selection.set(axis.group, value);
        next.push(selection);
      }
    }
    result = next;
  }
  return result;
}

export function variantCount(entry: RegistryEntry): number {
  return buildAxes(entry).reduce((total, axis) => total * axis.values.length, 1);
}

function variantClassLists(
  entry: RegistryEntry,
  anatomy: Anatomy,
  selection: Map<string, string>,
): ReadonlyMap<AnatomyRole, ReadonlyArray<string>> {
  const byRole = new Map<AnatomyRole, Array<string>>();
  for (const group of entry.variants) {
    const target = anatomy.targets[group.name] ?? "root";
    const wanted = selection.get(group.name) ?? entry.defaults[group.name];
    const value = group.values.find((candidate) => candidate.name === wanted) ?? group.values[0];
    if (value === undefined || value.classes.trim().length === 0) continue;
    const lists = byRole.get(target) ?? [];
    lists.push(value.classes);
    byRole.set(target, lists);
  }
  return byRole;
}

function styleForRole(
  node: AnatomyNode,
  entry: RegistryEntry,
  byRole: ReadonlyMap<AnatomyRole, ReadonlyArray<string>>,
): ResolvedStyle {
  const lists: Array<string> = [];
  if (node.classes !== undefined) lists.push(node.classes);
  if (node.role === "root" && entry.baseStyles !== null) lists.push(entry.baseStyles);
  const variantLists = byRole.get(node.role);
  if (variantLists !== undefined) lists.push(...variantLists);
  return resolveStyleList(lists);
}

function planNode(
  node: AnatomyNode,
  entry: RegistryEntry,
  byRole: ReadonlyMap<AnatomyRole, ReadonlyArray<string>>,
): PlannedNode {
  return {
    role: node.role,
    kind: node.kind,
    text: node.kind === "text" ? (node.text ?? entry.name) : null,
    style: styleForRole(node, entry, byRole),
    children: (node.children ?? []).map((child) => planNode(child, entry, byRole)),
  };
}

function variantName(axes: ReadonlyArray<Axis>, selection: Map<string, string>): string {
  if (axes.length === 0) return "variant=default";
  return axes.map((axis) => `${axis.group}=${selection.get(axis.group) ?? "default"}`).join(", ");
}

export function planComponent(
  entry: RegistryEntry,
  selection: Map<string, string>,
): PlannedComponent {
  const anatomy = anatomyFor(entry.slug, entry.name);
  return {
    name: variantName(buildAxes(entry), selection),
    root: planNode(anatomy.root, entry, variantClassLists(entry, anatomy, selection)),
  };
}

export function planComponents(entry: RegistryEntry): ReadonlyArray<PlannedComponent> {
  const anatomy = anatomyFor(entry.slug, entry.name);
  const axes = buildAxes(entry);
  return buildSelections(axes).map((selection) => ({
    name: variantName(axes, selection),
    root: planNode(anatomy.root, entry, variantClassLists(entry, anatomy, selection)),
  }));
}
