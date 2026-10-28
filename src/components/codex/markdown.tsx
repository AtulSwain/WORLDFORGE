import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Safe Markdown rendering: raw HTML in user content is not rendered (react-markdown's default),
 * and only http(s)/relative links are allowed.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="wf-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (/^(https?:|\/|#)/i.test(url) ? url : "")}
        components={{
          a: ({ href, children: c }) => (
            <a href={href} rel="noopener noreferrer nofollow" target={href?.startsWith("http") ? "_blank" : undefined}>
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
