"use client";
import { Highlight, themes } from "prism-react-renderer";
import React from "react";
import { CopyButton } from "./CopyButton";

type Props = {
  code: string;
  language?: string;
  fileName?: string;
  showLineNumbers?: boolean;
};

export const Code: React.FC<Props> = ({
  code,
  language = "",
  fileName,
  showLineNumbers = false,
}) => {
  if (!code) return null;

  return (
    <figure className="code-block">
      {fileName && (
        <figcaption className="text-xs font-medium text-muted-foreground mb-2">
          {fileName}
        </figcaption>
      )}
      <Highlight code={code} language={language} theme={themes.vsDark}>
        {({ getLineProps, getTokenProps, tokens }) => (
          <pre className="bg-black p-4 border text-xs border-border rounded overflow-x-auto">
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ className: "table-row", line })}>
                {showLineNumbers && (
                  <span className="table-cell select-none text-right text-white/25 pr-4">
                    {i + 1}
                  </span>
                )}
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
            <CopyButton code={code} />
          </pre>
        )}
      </Highlight>
    </figure>
  );
};
