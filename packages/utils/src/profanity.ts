import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export type ProfanityResult =
  | { readonly hasProfanity: true; readonly message: string }
  | { readonly hasProfanity: false; readonly message?: undefined };

export const checkProfanity = (text: string): ProfanityResult => {
  if (matcher.hasMatch(text)) {
    return {
      hasProfanity: true,
      message: "Your message contains profanity. Please keep it clean!",
    };
  }
  return { hasProfanity: false };
};
