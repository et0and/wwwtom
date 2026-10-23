import * as stylex from "@stylexjs/stylex";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { Loader } from "@tom/ui/loader";
import { bannerTitleStyles } from "../chrome/layout.stylex";

const styles = stylex.create({
  detailLoading: {
    marginInline: "auto",
    padding: "2rem",
    maxWidth: "750px",
  },
});

/** Loading shell for post/work detail pages while the query is pending. */
export const DetailLoading = () => (
  <main id="main" {...stylex.attrs(styles.detailLoading)}>
    <Loader />
  </main>
);

/** Not-found state for settled-null detail reads (the fetcher maps 404s to null). */
export const DetailNotFound = (props: { kind: "post" | "work"; slug: string | undefined }) => (
  <PageLayout title="Not found" description="The page you are looking for does not exist.">
    <article>
      <Text variant="heading" size="lg" as="h1">
        Not found
      </Text>
      <div>
        <Text>
          The {props.kind} "{props.slug}" does not exist.
        </Text>
      </div>
    </article>
  </PageLayout>
);

/** Error banner for settled-error detail reads (500s, timeouts). */
export const DetailError = (props: { kind: "post" | "work"; message: string }) => (
  <PageLayout title="Error" description={`Something went wrong loading this ${props.kind}.`}>
    <article>
      <Text variant="heading" size="lg" as="h1">
        Error
      </Text>
      <div>
        <div class="banner" role="alert">
          <Text style={bannerTitleStyles.bannerTitle}>Error loading {props.kind}</Text>
          <Text>{props.message}</Text>
        </div>
      </div>
    </article>
  </PageLayout>
);

/** Source link back to the are.na channel a post or work is drawn from. */
export const ArenaSourceLink = (props: { arenaSlug: string }) => (
  <a href={`https://are.na/tom/${props.arenaSlug}`} target="_blank" rel="noopener noreferrer">
    <Text variant="secondary" size="sm" as="span">
      View on are.na
    </Text>
  </a>
);
