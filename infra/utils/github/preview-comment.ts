import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import { Effect, Option, Schema } from "effect";

/**
 * A PR number from the CI env. `PULL_REQUEST` is always a string, so it is
 * decoded as one: `Schema.Int` rejects `"175"` outright, which silently
 * skipped every preview comment.
 */
const PullRequestNumber = Schema.FiniteFromString.check(Schema.isInt(), Schema.isGreaterThan(0));

/** The PR this deploy belongs to, or None when the deploy is not a PR. */
export const previewPullRequestNumber = (value: string | undefined): Option.Option<number> =>
  Option.fromNullishOr(Option.getOrUndefined(Schema.decodeUnknownOption(PullRequestNumber)(value)));

type PreviewCommentProps = {
  id?: string;
  name: string;
  url: string | undefined | Output.Output<string | undefined, never>;
};

export const previewComment = ({ id = "preview-comment", name, url }: PreviewCommentProps) =>
  Effect.gen(function* () {
    const issueNumber = previewPullRequestNumber(process.env.PULL_REQUEST);
    if (Option.isNone(issueNumber)) {
      return;
    }

    yield* GitHub.Comment(id, {
      owner: "et0and",
      repository: "wwwtom",
      issueNumber: issueNumber.value,
      body: Output.interpolate`
## ${name} Preview Deployed

**URL:** ${url}

Built from commit ${process.env.GITHUB_SHA?.slice(0, 7) ?? "unknown"}.

_This comment updates automatically with each push._
      `,
    });
  });
