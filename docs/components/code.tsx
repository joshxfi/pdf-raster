import { highlight } from "fumadocs-core/highlight";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

/**
 * Server-highlighted code block for pages outside MDX. fumadocs-ui's
 * ServerCodeBlock (16.6.10) renders nothing, so this calls highlight()
 * directly with the same CodeBlock chrome the docs use.
 */
export async function Code({
  code,
  lang = "ts",
  title,
}: {
  code: string;
  lang?: "ts" | "tsx" | "bash";
  title?: string;
}) {
  return highlight(code, {
    lang,
    components: {
      pre: (props) => (
        <CodeBlock {...props} title={title} className="my-0">
          <Pre>{props.children}</Pre>
        </CodeBlock>
      ),
    },
  });
}
