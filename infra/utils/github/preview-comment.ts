import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import { Effect, Option, Schema } from "effect";

/** A PR number from the CI env. Anything else is no comment at all. */
const pullRequestNumber = (value: string | undefined): Option.Option<number> =>
  Option.fromNullishOr(
    Option.getOrUndefined(
      Schema.decodeUnknownOption(Schema.Int.check(Schema.isGreaterThan(0)))(value),
    ),
  );

type PreviewCommentProps = {
  id?: string;
  name: string;
  url: string | undefined | Output.Output<string | undefined, never>;
};

export const previewComment = ({ id = "preview-comment", name, url }: PreviewCommentProps) =>
  Effect.gen(function* () {
    const issueNumber = pullRequestNumber(process.env.PULL_REQUEST);
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
