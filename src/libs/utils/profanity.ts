import {
	RegExpMatcher,
	englishDataset,
	englishRecommendedTransformers,
} from "obscenity";

const matcher = new RegExpMatcher({
	...englishDataset.build(),
	...englishRecommendedTransformers,
});

export const hasProfanity = (text: string): boolean => {
	return matcher.hasMatch(text);
};

export const checkProfanity = (
	text: string,
): { hasProfanity: boolean; message?: string } => {
	if (matcher.hasMatch(text)) {
		return {
			hasProfanity: true,
			message: "Your message contains profanity. Please keep it clean!",
		};
	}
	return { hasProfanity: false };
};
