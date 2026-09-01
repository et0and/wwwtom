import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export const hasProfanity = (text: string): boolean => {
  return matcher.hasMatch(text);
};

export type ProfanityResult = {
  hasProfanity: boolean;
  message?: string;
};

export const checkProfanity = (text: string): ProfanityResult => {
  if (matcher.hasMatch(text)) {
    return {
      hasProfanity: true,
      message: "Your message contains profanity. Please keep it clean!",
    };
  }
  return { hasProfanity: false };
};
