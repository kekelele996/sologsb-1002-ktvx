import { create } from 'zustand'
import type { Comment, EditConflict, Paragraph, Reply, ReviewBatch, Role, Version } from '../types'

const DRAFT_KEY = 'sologsb-1002-draft-v1'
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const baseParagraphs: Paragraph[] = [
  { id: 'p-01', section: '摘要', number: '1.', text: '开源软件供应链的稳定性不仅取决于代码质量，也取决于维护者能否持续识别并回应社区需求。', original: '开源软件供应链的稳定性不仅取决于代码质量，也取决于维护者能否持续识别并回应社区需求。', status: 'accepted', highlighted: false },
  { id: 'p-02', section: '1 引言', number: '2.', text: '近年来，大型语言模型被广泛用于代码生成与缺陷定位，但其在真实维护工作流中的影响仍缺少系统证据。', original: '近年来，大型语言模型被广泛用于代码生成与缺陷定位，但其在真实维护工作流中的影响仍缺少系统证据。', status: 'open', highlighted: true },
  { id: 'p-03', section: '1 引言', number: '3.', text: '本文收集 12 个活跃开源项目连续 18 个月的议题记录，并访谈 26 位核心维护者。', original: '本文收集 12 个活跃开源项目连续 18 个月的议题记录，并访谈 26 位核心维护者。', status: 'open', highlighted: true },
  { id: 'p-04', section: '2 方法', number: '4.', text: '我们采用混合研究方法，将议题生命周期划分为响应、评审与合并三个阶段。编码过程由两名研究者独立完成。', original: '我们采用混合研究方法，将议题生命周期划分为响应、评审与合并三个阶段。编码过程由两名研究者独立完成。', status: 'open', highlighted: false },
  { id: 'p-05', section: '2 方法', number: '5.', text: '当编码结果不一致时，研究者通过讨论达成一致；若仍有分歧，则邀请第三位研究者裁决。', original: '当编码结果不一致时，研究者通过讨论达成一致；若仍有分歧，则邀请第三位研究者裁决。', status: 'accepted', highlighted: true },
  { id: 'p-06', section: '3 结果', number: '6.', text: '初步结果显示，辅助工具缩短了首次响应时间，但没有显著降低维护者处理复杂议题的认知负担。', original: '初步结果显示，辅助工具缩短了首次响应时间，但没有显著降低维护者处理复杂议题的认知负担。', status: 'open', highlighted: true },
  { id: 'p-07', section: '3 结果', number: '7.', text: '在高活跃度项目中，维护者更关注建议是否可验证，而非建议生成速度。', original: '在高活跃度项目中，维护者更关注建议是否可验证，而非建议生成速度。', status: 'open', highlighted: false },
]
const seedBatchId = 'b-seed-01'
const baseComments: Comment[] = [
  { id: 'c-01', paragraphId: 'p-02', author: '审稿人 A', role: 'reviewer', type: 'suggestion', quote: '其真实维护工作流中的影响', body: '建议把“影响”具体化为可观察指标。', suggestion: '近年来，大型语言模型被广泛用于代码生成与缺陷定位，但在真实维护工作流中究竟改变了哪些协作行为，仍缺少系统证据。', status: 'open', replies: [{ id: 'r-01', author: '作者', role: 'author', body: '可以，修改后会补充指标定义。', createdAt: Date.now() - 7200000 }], createdAt: Date.now() - 86400000, batchId: seedBatchId },
  { id: 'c-02', paragraphId: 'p-02', author: '审稿人 B', role: 'reviewer', type: 'comment', quote: '缺少系统证据', body: '这里的“系统证据”范围过大，建议限定为本研究覆盖的议题语料。', status: 'open', replies: [], createdAt: Date.now() - 64000000, batchId: seedBatchId },
  { id: 'c-03', paragraphId: 'p-03', author: '审稿人 A', role: 'reviewer', type: 'comment', quote: '26 位核心维护者', body: '请说明抽样方式和地域分布，避免样本选择偏差。', status: 'open', replies: [], createdAt: Date.now() - 54000000, batchId: seedBatchId },
  { id: 'c-04', paragraphId: 'p-04', author: '审稿人 C', role: 'reviewer', type: 'comment', quote: '两名研究者独立完成', body: '建议报告编码者间一致性系数，并明确不一致处理规则。', status: 'open', replies: [], createdAt: Date.now() - 48000000, batchId: seedBatchId },
  { id: 'c-05', paragraphId: 'p-05', author: '审稿人 D', role: 'reviewer', type: 'comment', quote: '邀请第三位研究者裁决', body: '与上一段重复：都在说明编码分歧如何解决，建议合并意见。', status: 'open', replies: [], createdAt: Date.now() - 43000000, batchId: seedBatchId },
  { id: 'c-06', paragraphId: 'p-06', author: '审稿人 B', role: 'reviewer', type: 'suggestion', quote: '但没有显著降低维护者处理复杂议题的认知负担', body: '“显著”需要给出统计检验与效应量。', suggestion: '初步结果显示，辅助工具缩短了首次响应时间，但对复杂议题处理时长与自我报告认知负担均未产生统计显著影响。', status: 'open', replies: [], createdAt: Date.now() - 36000000, batchId: seedBatchId },
]

/** 打开批次时：段落文字快照 + 每条待处理意见所针对的原文基线 */
const buildBatch = (batchId: string, label: string, paragraphs: Paragraph[], pendingComments: Comment[]): ReviewBatch => ({
  id: batchId,
  label,
  status: 'open',
  startedAt: Date.now(),
  paragraphSnapshots: Object.fromEntries(paragraphs.map((paragraph) => [paragraph.id, paragraph.text])),
  commentBaselines: Object.fromEntries(pendingComments.map((comment) => [comment.id, paragraphs.find((paragraph) => paragraph.id === comment.paragraphId)?.text ?? ''])),
})
const seedBatch = buildBatch(seedBatchId, '第二轮外审批次', baseParagraphs, baseComments)
seedBatch.startedAt = Date.now() - 172800000

const seed = typeof localStorage !== 'undefined' ? localStorage.getItem(DRAFT_KEY) : null
const parsed = seed ? JSON.parse(seed) as Partial<{ paragraphs: Paragraph[]; comments: Comment[]; versions: Version[]; batches: ReviewBatch[] }> : null
const initialParagraphs = parsed?.paragraphs?.length ? parsed.paragraphs : baseParagraphs
const initialComments = parsed?.comments ?? baseComments
const initialBatches: ReviewBatch[] = parsed?.batches ?? [seedBatch]
const initialVersions: Version[] = parsed?.versions ?? [
  { id: 'v-01', label: '投稿初稿 v1', createdAt: Date.now() - 1209600000, paragraphs: JSON.parse(JSON.stringify(baseParagraphs)) as Paragraph[] },
  { id: 'v-02', label: '审阅基线 v2', createdAt: Date.now() - 172800000, paragraphs: JSON.parse(JSON.stringify(baseParagraphs.map((p) => p.id === 'p-04' ? { ...p, text: `${p.text} 编码规则在预注册方案中说明。` } : p))) as Paragraph[] },
]

const persistDraft = (paragraphs: Paragraph[], comments: Comment[], versions: Version[], batches: ReviewBatch[]) => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ paragraphs, comments, versions, batches }))
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** 待处理：尚未形成结论、仍阻塞批次关闭的意见 */
export const isPending = (comment: Comment) => comment.status === 'open'

/**
 * 过时判定（纯函数，随正文变化实时推导）：
 * 意见属于某个进行中的批次、仍待处理，且其基线原文与当前段落文字不一致。
 */
export const getStaleCommentIds = (paragraphs: Paragraph[], comments: Comment[], batches: ReviewBatch[]): Set<string> => {
  const batch = batches.find((item) => item.status === 'open')
  if (!batch) return new Set()
  const textOf = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph.text]))
  return new Set(comments.filter((comment) =>
    isPending(comment) &&
    Object.prototype.hasOwnProperty.call(batch.commentBaselines, comment.id) &&
    batch.commentBaselines[comment.id] !== (textOf.get(comment.paragraphId) ?? ''),
  ).map((comment) => comment.id))
}

interface ReviewState {
  role: Role
  paragraphs: Paragraph[]
  comments: Comment[]
  versions: Version[]
  batches: ReviewBatch[]
  selectedParagraphId: string
  commentFilter: 'all' | 'open' | 'suggestion' | 'duplicate' | 'stale'
  revisionMode: boolean
  dirty: boolean
  conflicts: EditConflict[]
  past: HistorySnapshotLike[]
  future: HistorySnapshotLike[]
  setRole: (role: Role) => void
  selectParagraph: (id: string) => void
  setCommentFilter: (filter: ReviewState['commentFilter']) => void
  setRevisionMode: (value: boolean) => void
  updateParagraph: (id: string, text: string) => void
  addComment: (input: Pick<Comment, 'paragraphId' | 'type' | 'quote' | 'body' | 'suggestion'>) => void
  replyComment: (commentId: string, body: string) => void
  resolveSuggestion: (commentId: string, accepted: boolean) => void
  resolveComment: (commentId: string) => void
  mergeComment: (commentId: string, targetId: string) => void
  toggleLock: (paragraphId: string) => void
  createVersion: (label: string) => void
  startBatch: (label?: string) => void
  confirmComment: (commentId: string) => void
  withdrawComment: (commentId: string) => void
  closeBatch: (label?: string) => { ok: boolean; reason?: string }
  addConflict: (conflict: EditConflict) => void
  resolveConflict: (conflictId: string, strategy: 'local' | 'remote') => void
  dismissConflict: (conflictId: string) => void
  undo: () => void
  redo: () => void
  save: () => void
  resetDemo: () => void
}
type HistorySnapshotLike = { paragraphs: Paragraph[]; comments: Comment[]; versions: Version[]; batches: ReviewBatch[] }

export const useReviewStore = create<ReviewState>((set, get) => {
  const snapshot = (state: ReviewState): HistorySnapshotLike => ({
    paragraphs: clone(state.paragraphs), comments: clone(state.comments), versions: clone(state.versions), batches: clone(state.batches),
  })
  const record = (producer: (state: ReviewState) => Partial<ReviewState>) => set((state) => {
    const history = snapshot(state)
    const next = producer(state)
    const paragraphs = next.paragraphs ?? state.paragraphs
    const comments = next.comments ?? state.comments
    const versions = next.versions ?? state.versions
    const batches = next.batches ?? state.batches
    persistDraft(paragraphs, comments, versions, batches)
    return { ...next, past: [...state.past.slice(-49), history], future: [], dirty: true }
  })

  return {
    role: 'reviewer',
    paragraphs: initialParagraphs,
    comments: initialComments,
    versions: initialVersions,
    batches: initialBatches,
    selectedParagraphId: 'p-02',
    commentFilter: 'all',
    revisionMode: false,
    dirty: false,
    conflicts: [],
    past: [],
    future: [],
    setRole: (role) => set({ role, selectedParagraphId: get().paragraphs[0]?.id ?? '' }),
    selectParagraph: (selectedParagraphId) => set({ selectedParagraphId }),
    setCommentFilter: (commentFilter) => set({ commentFilter }),
    setRevisionMode: (revisionMode) => set({ revisionMode }),
    updateParagraph: (paragraphId, text) => record((state) => ({
      paragraphs: state.paragraphs.map((paragraph) => paragraph.id === paragraphId && paragraph.status !== 'locked'
        ? { ...paragraph, text, status: 'open' as const, highlighted: true }
        : paragraph),
    })),
    addComment: (input) => record((state) => {
      const newComment: Comment = {
        ...input,
        id: id('comment'),
        author: state.role === 'reviewer' ? '审稿人 A' : state.role === 'author' ? '作者' : '编辑',
        role: state.role,
        status: 'open',
        replies: [],
        createdAt: Date.now(),
      }
      // 审稿人在批次进行中添加的批注与建议都归进当前批次
      const openBatch = state.batches.find((batch) => batch.status === 'open')
      if (openBatch) {
        const currentText = state.paragraphs.find((paragraph) => paragraph.id === newComment.paragraphId)?.text ?? ''
        newComment.batchId = openBatch.id
        return {
          comments: [newComment, ...state.comments],
          batches: state.batches.map((batch) => batch.id === openBatch.id
            ? { ...batch, commentBaselines: { ...batch.commentBaselines, [newComment.id]: currentText } }
            : batch),
        }
      }
      return { comments: [newComment, ...state.comments] }
    }),
    replyComment: (commentId, body) => record((state) => ({
      comments: state.comments.map((comment) => comment.id === commentId ? {
        ...comment,
        replies: [...comment.replies, { id: id('reply'), author: state.role === 'author' ? '作者' : state.role === 'reviewer' ? '审稿人 A' : '编辑', role: state.role, body, createdAt: Date.now() } as Reply],
      } : comment),
    })),
    resolveSuggestion: (commentId, accepted) => record((state) => {
      const comment = state.comments.find((item) => item.id === commentId)
      // 过时建议暂停接受：必须先由审稿人按新文字确认或撤回
      if (!comment || getStaleCommentIds(state.paragraphs, state.comments, state.batches).has(commentId)) return {}
      return {
        comments: state.comments.map((item) => item.id === commentId ? { ...item, status: accepted ? 'accepted' : 'rejected' } : item),
        paragraphs: comment?.suggestion && accepted
          ? state.paragraphs.map((paragraph) => paragraph.id === comment.paragraphId ? { ...paragraph, text: comment.suggestion as string, status: 'accepted' } : paragraph)
          : state.paragraphs,
      }
    }),
    resolveComment: (commentId) => record((state) => {
      if (getStaleCommentIds(state.paragraphs, state.comments, state.batches).has(commentId)) return {}
      return {
        comments: state.comments.map((item) => item.id === commentId ? { ...item, status: 'resolved' as const } : item),
      }
    }),
    mergeComment: (commentId, targetId) => record((state) => {
      if (getStaleCommentIds(state.paragraphs, state.comments, state.batches).has(commentId)) return {}
      return {
        comments: state.comments.map((comment) => comment.id === commentId ? { ...comment, status: 'merged' as const, mergedInto: targetId } : comment),
      }
    }),
    toggleLock: (paragraphId) => record((state) => ({
      paragraphs: state.paragraphs.map((paragraph) => paragraph.id === paragraphId ? {
        ...paragraph,
        status: paragraph.status === 'locked' ? 'accepted' : 'locked',
      } : paragraph),
    })),
    createVersion: (label) => record((state) => ({
      versions: [{ id: id('version'), label: label.trim() || `版本 ${state.versions.length + 1}`, createdAt: Date.now(), paragraphs: clone(state.paragraphs) }, ...state.versions],
    })),
    // 开始审阅批次：冻结各段文字，并把当前所有待处理意见收进批次
    startBatch: (label) => record((state) => {
      if (state.batches.some((batch) => batch.status === 'open')) return {}
      const batchId = id('batch')
      const pending = state.comments.filter(isPending)
      const batch = buildBatch(
        batchId,
        label?.trim() || `第 ${state.batches.filter((item) => item.status === 'closed').length + 2} 轮外审批次`,
        state.paragraphs,
        pending,
      )
      return {
        batches: [...state.batches, batch],
        comments: state.comments.map((comment) => isPending(comment) && !comment.batchId ? { ...comment, batchId } : comment),
      }
    }),
    // 审稿人按新文字确认：刷新该意见的原文基线，重新成为可处理状态
    confirmComment: (commentId) => record((state) => {
      const comment = state.comments.find((item) => item.id === commentId)
      const openBatch = state.batches.find((batch) => batch.status === 'open')
      if (!comment || !openBatch) return {}
      const currentText = state.paragraphs.find((paragraph) => paragraph.id === comment.paragraphId)?.text ?? ''
      return {
        batches: state.batches.map((batch) => batch.id === openBatch.id
          ? { ...batch, commentBaselines: { ...batch.commentBaselines, [commentId]: currentText } }
          : batch),
      }
    }),
    // 审稿人撤回过时意见
    withdrawComment: (commentId) => record((state) => ({
      comments: state.comments.map((item) => item.id === commentId ? { ...item, status: 'withdrawn' as const } : item),
    })),
    // 结束批次：意见全部处理完才能完成，并把正文存成新版本
    closeBatch: (label) => {
      const state = get()
      const openBatch = state.batches.find((batch) => batch.status === 'open')
      if (!openBatch) return { ok: false, reason: '当前没有进行中的批次' }
      const trackedIds = new Set(Object.keys(openBatch.commentBaselines))
      const pending = state.comments.filter((comment) => trackedIds.has(comment.id) && isPending(comment))
      if (pending.length) return { ok: false, reason: `还有 ${pending.length} 条意见待处理，全部处理完才能结束批次` }
      const versionId = id('version')
      record((current) => ({
        versions: [{
          id: versionId,
          label: label?.trim() || `${openBatch.label}定稿 v${current.versions.length + 1}`,
          createdAt: Date.now(),
          paragraphs: clone(current.paragraphs),
        }, ...current.versions],
        batches: current.batches.map((batch) => batch.id === openBatch.id
          ? { ...batch, status: 'closed' as const, closedAt: Date.now(), versionId }
          : batch),
      }))
      return { ok: true }
    },
    addConflict: (conflict) => set((state) => ({ conflicts: [conflict, ...state.conflicts] })),
    resolveConflict: (conflictId, strategy) => record((state) => {
      const conflict = state.conflicts.find((item) => item.id === conflictId)
      return {
        paragraphs: conflict && strategy === 'remote'
          ? state.paragraphs.map((paragraph) => paragraph.id === conflict.paragraphId ? { ...paragraph, text: conflict.remoteText, highlighted: true } : paragraph)
          : state.paragraphs,
        conflicts: state.conflicts.filter((item) => item.id !== conflictId),
      }
    }),
    dismissConflict: (conflictId) => set((state) => ({ conflicts: state.conflicts.filter((item) => item.id !== conflictId) })),
    undo: () => set((state) => {
      const previous = state.past.at(-1)
      if (!previous) return state
      const current = snapshot(state)
      persistDraft(previous.paragraphs, previous.comments, previous.versions, previous.batches)
      return { ...previous, past: state.past.slice(0, -1), future: [current, ...state.future], dirty: true }
    }),
    redo: () => set((state) => {
      const next = state.future[0]
      if (!next) return state
      const current = snapshot(state)
      persistDraft(next.paragraphs, next.comments, next.versions, next.batches)
      return { ...next, past: [...state.past, current], future: state.future.slice(1), dirty: true }
    }),
    save: () => {
      const state = get()
      persistDraft(state.paragraphs, state.comments, state.versions, state.batches)
      set({ dirty: false })
    },
    resetDemo: () => {
      const freshBatch = buildBatch(seedBatchId, '第二轮外审批次', baseParagraphs, baseComments)
      freshBatch.startedAt = Date.now() - 172800000
      localStorage.removeItem(DRAFT_KEY)
      set({ paragraphs: clone(baseParagraphs), comments: clone(baseComments), versions: clone(initialVersions), batches: [freshBatch], conflicts: [], past: [], future: [], dirty: false })
      persistDraft(baseParagraphs, baseComments, initialVersions, [freshBatch])
    },
  }
})
