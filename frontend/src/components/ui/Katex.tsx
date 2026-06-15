import katex from 'katex';
import 'katex/dist/katex.min.css';

interface KatexProps {
  math: string;
  block?: boolean;
}

export function Katex({ math, block = false }: KatexProps) {
  const html = katex.renderToString(math, {
    throwOnError: false,
    displayMode: block,
    output: 'html',
  });
  return (
    <span
      className="katex-inline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
