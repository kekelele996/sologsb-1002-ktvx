export type Role = 'author' | 'reviewer' | 'editor'
export type ParagraphStatus = 'open' | 'accepted' | 'locked'
export type CommentStatus = 'open' | 'accepted' | 'rejected' | 'merged' | 'resolved' | 'withdrawn'
export type CommentType = 'comment' | 'suggestion'

export interface Reply {
  id: string
  author: string
  role: Role
  body: string
  createdAt: number
}

export interface Comment {
  id: string
  paragraphId: string
  author: string
  role: Role
  type: CommentType
  quote: string
  body: string
  suggestion?: string
  status: CommentStatus
  replies: Reply[]
  createdAt: number
  mergedInto?: string
  /** 所属审阅批次；批次开始后新增的意见也归到该批次 */
  batchId?: string
}

export interface Paragraph {
  id: string
  section: string
  number: string
  text: string
  original: string
  status: ParagraphStatus
  highlighted: boolean
}

export interface Version {
  id: string
  label: string
  createdAt: number
  paragraphs: Paragraph[]
}

export interface EditConflict {
  id: string
  paragraphId: string
  localText: string
  remoteText: string
  localAuthor: string
  remoteAuthor: string
  detectedAt: number
}

/**
 * 编辑发起的审阅批次（外审轮次）。
 * - startBatch 时冻结全部段落文字（paragraphSnapshots）和各待处理意见所针对的原文（commentBaselines）。
 * - 批次进行中段落文字变化后，基线文字与现文不一致的“待处理”意见即视为过时，
 *   必须由审稿人按新文字确认（刷新基线）或撤回后才能继续处理。
 * - 批次关闭时所有意见必须处理完毕，并把正文保存为新版本；未关闭的草稿重开可继续。
 */
export interface ReviewBatch {
  id: string
  label: string
  status: 'open' | 'closed'
  startedAt: number
  closedAt?: number
  /** 关闭批次时生成的新版本 */
  versionId?: string
  /** 批次开始时各段文字快照：paragraphId -> text */
  paragraphSnapshots: Record<string, string>
  /** 纳入批次的意见在加入时所针对的段落文字：commentId -> text */
  commentBaselines: Record<string, string>
}

export interface HistorySnapshot {
  paragraphs: Paragraph[]
  comments: Comment[]
  versions: Version[]
  batches: ReviewBatch[]
}
