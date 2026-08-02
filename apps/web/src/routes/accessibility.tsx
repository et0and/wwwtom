import { PageLayout } from "~/layouts";
import { BlurInSection, BlurInText } from "~/components";

export default function Accessibility() {
  return (
    <PageLayout title="Accessibility" description="Accessibility statement">
      <BlurInText text="Accessibility" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <p>
          I am committed to providing a website that is accessible to the widest possible audience
          in accordance with the New Zealand Web Accessibility standards and WCAG guidelines, and am
          committed to providing a positive experience to all users as I strive to promote
          accessibility and inclusion.
        </p>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <p>
          I am actively working to increase accessibility and usability of my website to everyone.
          If you are using a screen reader or other auxiliary aid and are having problems using this
          website, please contact me. Whether you are using assistive technologies like a screen
          reader, a magnifier, voice recognition software, or captions for videos, my goal is to
          make your visit to this website a successful and enjoyable experience.
        </p>
      </BlurInSection>
      <BlurInSection delay={0.7}>
        <p>
          If you have difficulty using or accessing any element of this website, please feel free to
          email me at <a href="mailto:access@tomhackshaw.com">access@tomhackshaw.com</a> and I will
          work with you to provide the information, item, or element you seek through a
          communication method that is accessible for you consistent with applicable law.
        </p>
      </BlurInSection>
      <BlurInSection delay={0.9}>
        <p>
          I am currently taking a variety of steps and devoting resources to further enhance the
          accessibility of my website. Currently, I am working on implementing proper keyboard
          navigation with appropriate hover and focus state. After this I will be looking at colour
          contrast across the entire site to ensure this meets AA levels or higher.
        </p>
      </BlurInSection>
      <BlurInSection delay={1.1}>
        <p>
          Using tools such as WAVE, NVDA, Axe and Lighthouse I am working towards greater
          accessibility of this website, and hope to work with an independent accessibility
          consultant sometime in the future to conduct a deeper audit.
        </p>
      </BlurInSection>
      <BlurInText text="Known issues" tag="h2" baseDelay={1.3} step={0.025} />
      <BlurInSection delay={1.5}>
        <ul>
          <li>colour contrast is not AA level or higher in some areas</li>
          <li>improper ordering of headers on some pages</li>
          <li>use of technical language on some pages that could use plain language</li>
        </ul>
      </BlurInSection>
    </PageLayout>
  );
}
