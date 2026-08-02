declare module 'react-syntax-highlighter' {
  import * as React from 'react';
  export class Prism extends React.Component<any, any> {}
  export class SyntaxHighlighter extends React.Component<any, any> {}
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  const oneDark: any;
  export { oneDark };
}
