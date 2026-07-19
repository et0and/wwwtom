import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import { Effect } from "effect";

type PreviewCommentProps = {
  name: string;
  url: string | undefined | Output.Output<string | undefined, never>;
};

export const previewComment = ({ name, url }: PreviewCommentProps) =>
  Effect.gen(function* () {
    if (!process.env.PULL_REQUEST) {
      return;
    }

    yield* GitHub.Comment("preview-comment", {
      owner: "et0and",
      repository: "wwwtom",
      issueNumber: Number(process.env.PULL_REQUEST),
      body: Output.interpolate`
## ${name} Preview Deployed

**URL:** ${url}

Built from commit ${process.env.GITHUB_SHA?.slice(0, 7) ?? "unknown"}.

_This comment updates automatically with each push._
      `,
    });
  });
