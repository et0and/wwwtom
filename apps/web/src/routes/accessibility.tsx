import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";

export default function Accessibility() {
  return (
    <PageLayout title="Accessibility" description="Accessibility statement">
      <BlurInText text="Accessibility" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <Text>
          I am committed to providing a website that is accessible to the widest possible audience
          in accordance with the New Zealand Web Accessibility standards and WCAG guidelines, and am
          committed to providing a positive experience to all users as I strive to promote
          accessibility and inclusion.
        </Text>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <Text>
          I am actively working to increase accessibility and usability of my website to everyone.
          If you are using a screen reader or other auxiliary aid and are having problems using this
          website, please contact me. Whether you are using assistive technologies like a screen
          reader, a magnifier, voice recognition software, or captions for videos, my goal is to
          make your visit to this website a successful and enjoyable experience.
        </Text>
      </BlurInSection>
      <BlurInSection delay={0.7}>
        <Text>
          If you have difficulty using or accessing any element of this website, please feel free to
          email me at <a href="mailto:access@tomhackshaw.com">access@tomhackshaw.com</a> and I will
          work with you to provide the information, item, or element you seek through a
          communication method that is accessible for you consistent with applicable law.
        </Text>
      </BlurInSection>
      <BlurInSection delay={0.9}>
        <Text>
          I am currently taking a variety of steps and devoting resources to further enhance the
          accessibility of my website. Currently, I am working on implementing proper keyboard
          navigation with appropriate hover and focus state. After this I will be looking at colour
          contrast across the entire site to ensure this meets AA levels or higher.
        </Text>
      </BlurInSection>
      <BlurInSection delay={1.1}>
        <Text>
          Using tools such as WAVE, NVDA, Axe and Lighthouse I am working towards greater
          accessibility of this website, and hope to work with an independent accessibility
          consultant sometime in the future to conduct a deeper audit.
        </Text>
      </BlurInSection>
      <BlurInText text="Known issues" tag="h2" baseDelay={1.3} step={0.025} />
      <BlurInSection delay={1.5}>
        <ul>
          <Text as="li">colour contrast is not AA level or higher in some areas</Text>
          <Text as="li">improper ordering of headers on some pages</Text>
          <Text as="li">use of technical language on some pages that could use plain language</Text>
        </ul>
      </BlurInSection>
    </PageLayout>
  );
}
