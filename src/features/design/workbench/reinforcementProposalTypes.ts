import type { DesignCodeId } from '../../../design/elements/codes';

export type ProposalSnapshot = Readonly<Record<string, string>>;
export type ReinforcementProposalRequest =
  | { readonly kind: 'column'; readonly requestId: number; readonly code: DesignCodeId; readonly snapshot: ProposalSnapshot }
  | { readonly kind: 'section'; readonly requestId: number; readonly snapshot: ProposalSnapshot; readonly diametersMm?: readonly number[] };
export type ReinforcementProposalMessage =
  | { readonly kind: 'proposed'; readonly requestId: number; readonly fields: Record<string, string> }
  | { readonly kind: 'failed'; readonly requestId: number; readonly reason: string };
