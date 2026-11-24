import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

const BUTTON_MODULE = "@tom/ui/button";

const isButtonLiteral = (attribute: ESTree.JSXAttribute): boolean => {
	const value = attribute.value;
	if (value === null) return false;
	if (value.type === "Literal") return value.value === "button";
	return (
		value.type === "JSXExpressionContainer" &&
		value.expression.type === "Literal" &&
		value.expression.value === "button"
	);
};

/** Disallow redundant type="button" on the Midori Button. */
export const noRedundantButtonTypeRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				'Disallow redundant type="button" on the Midori Button; the component already defaults to button.',
		},
		messages: {
			redundantButtonType:
				'Midori Button already defaults to type="button". Remove the redundant attribute.',
		},
	},
	create(context) {
		const buttonNames = new Set<string>();
		return {
			ImportDeclaration(node) {
				if (node.source.value !== BUTTON_MODULE) return;
				for (const specifier of node.specifiers) {
					if (
						specifier.type === "ImportSpecifier" &&
						specifier.imported.type === "Identifier" &&
						specifier.imported.name === "Button"
					) {
						buttonNames.add(specifier.local.name);
					}
				}
			},
			JSXOpeningElement(node) {
				if (
					node.name.type !== "JSXIdentifier" ||
					!buttonNames.has(node.name.name)
				) {
					return;
				}
				for (const attribute of node.attributes) {
					if (
						attribute.type === "JSXAttribute" &&
						attribute.name.type === "JSXIdentifier" &&
						attribute.name.name === "type" &&
						isButtonLiteral(attribute)
					) {
						context.report({
							node: attribute,
							messageId: "redundantButtonType",
						});
					}
				}
			},
		};
	},
});
