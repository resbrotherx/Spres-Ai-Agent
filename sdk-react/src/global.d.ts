declare module 'react-syntax-highlighter/dist/esm/prism-light.js' {
  import * as React from 'react';
  export default class PrismLight extends React.Component<any, any> {
    static registerLanguage(name: string, language: any): void;
  }
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/*' {
  const language: any;
  export default language;
}
