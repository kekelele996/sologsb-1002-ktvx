export type Role = 'author' | 'reviewer' | 'editor'
export type ParagraphStatus = 'open' | 'accepted' | 'locked'
export type CommentStatus = 'open' | 'accepted' | 'rejected' | 'merged' | 'outdated' | 'withdrawn'
export type CommentType = 'comment' | 'suggestion'
export type BatchStatus = 'draft' | 'closed'

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
  /** 该意见所锚定的段落文字；正文偏离此文字且批次仍在进行时，意见会被判为过时 */
  anchoredText?: string
  /** 意见被纳入的审阅批次 */
  batchId?: string
  /** 意见被标记过时的时间 */
  outdatedAt?: number
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
  /** 该版本由哪一个审阅批次结项时生成 */
  batchId?: string
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

export interface ReviewBatch {
  id: string
  label: string
  status: BatchStatus
  startedAt: number
  /** 批次开始时各段文字的快照，正文与此不同即说明段落在本批次中被改动 */
  paragraphBaselines: Record<string, string>
  /** 批次纳入的意见（开始时的待处理意见 + 进行中新增的批注与建议） */
  commentIds: string[]
  closedAt?: number
  /** 结项时生成的新版本 */
  versionId?: string
}

export interface HistorySnapshot {
  paragraphs: Paragraph[]
  comments: Comment[]
  versions: Version[]
  batches: ReviewBatch[]
}
