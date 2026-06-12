export interface TextQuoteSelector {
  type: "TextQuoteSelector";
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface AnnotationData {
  ghc: 1;
  src: string;
  page: string;
  selector: TextQuoteSelector;
  client?: string;
}

export interface Annotation {
  issueNumber: number;
  htmlUrl: string;
  author: string;
  comment: string;
  data: AnnotationData;
  rawBlock: string;
}
