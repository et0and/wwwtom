import React from "react";

import { Code } from "./Component.client";

export type CodeBlockProps = {
  code: string;
  language?: string;
  fileName?: string;
  showLineNumbers?: boolean;
  blockType: "code";
};

type Props = CodeBlockProps & {
  className?: string;
};

export const CodeBlock: React.FC<Props> = ({
  className,
  code,
  language,
  fileName,
  showLineNumbers,
}) => {
  return (
    <div className={[className, "not-prose"].filter(Boolean).join(" ")}>
      <Code code={code} language={language} fileName={fileName} showLineNumbers={showLineNumbers} />
    </div>
  );
};
