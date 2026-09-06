import preview from "#.storybook/preview";
import { Table } from "@tom/ui/tomui/table";
import { TableBody } from "@tom/ui/tomui/table";
import { TableCell } from "@tom/ui/tomui/table";
import { TableHead } from "@tom/ui/tomui/table";
import { TableHeader } from "@tom/ui/tomui/table";
import { TableRow } from "@tom/ui/tomui/table";

const meta = preview.meta({
  title: "web/Table",
  component: Table,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  render: () => (
    <Table class="w-xl">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada Lovelace</TableCell>
          <TableCell>Engineer</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Grace Hopper</TableCell>
          <TableCell>Reviewer</TableCell>
          <TableCell>Invited</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
});

export const FixedLayout = meta.story({
  render: () => (
    <Table layout="fixed" class="w-xl">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada Lovelace</TableCell>
          <TableCell>Engineer</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Grace Hopper</TableCell>
          <TableCell>Reviewer</TableCell>
          <TableCell>Invited</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
});

export const WithSelectedRow = meta.story({
  render: () => (
    <Table class="w-xl">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow variant="selected">
          <TableCell>Ada Lovelace</TableCell>
          <TableCell>Engineer</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Grace Hopper</TableCell>
          <TableCell>Reviewer</TableCell>
          <TableCell>Invited</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
});
