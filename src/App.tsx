import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftOutlined, ArrowRightOutlined, AuditOutlined, BranchesOutlined, CheckCircleOutlined, CheckOutlined,
  CloseOutlined, CommentOutlined, DiffOutlined, DeleteOutlined, FileDoneOutlined, FileTextOutlined,
  HistoryOutlined, LockOutlined, MenuFoldOutlined, MessageOutlined, PlayCircleOutlined, PlusOutlined,
  RedoOutlined, SaveOutlined, SendOutlined, StopOutlined, SwapOutlined, UndoOutlined, UnlockOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Alert, Badge, Button, Card, Checkbox, Empty, Input, Modal, Progress, Radio, Segmented, Select, Space, Tag, Tooltip, message } from 'antd'
import { submitRemotePatch } from './services/mockApi'
import { getStaleCommentIds, useReviewStore } from './store/review'
import type { Comment, CommentStatus, CommentType, Paragraph, ReviewBatch, Role } from './types'

const roleMeta: Record<Role, { label: string; description: string; color: string }> = {
  author: { label: '作者工作区', description: '编辑正文，逐条接受或拒绝修改建议', color: '#2f6f5e' },
  reviewer: { label: '审稿人工作区', description: '引用原文、添加批注与修改建议并参与讨论', color: '#9a5b25' },
  editor: { label: '编辑工作区', description: '管理审阅批次、合并重复意见、锁定段落并比较版本', color: '#5b4d8e' },
}
const roleIcon = (role: Role) => role === 'author' ? <FileDoneOutlined /> : role === 'reviewer' ? <CommentOutlined /> : <BranchesOutlined />
const formatDate = (value: number) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const commentStatusMeta: Record<CommentStatus, { label: string; color: string }> = {
  open: { label: '待处理', color: 'orange' },
  accepted: { label: '已接受', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
  merged: { label: '已合并', color: 'blue' },
  resolved: { label: '已处理', color: 'cyan' },
  withdrawn: { label: '已撤回', color: 'default' },
}

export default function App() {
  const {
    role, paragraphs, comments, versions, batches, selectedParagraphId, commentFilter, revisionMode, dirty, conflicts,
    setRole, selectParagraph, setCommentFilter, setRevisionMode, updateParagraph, addComment, replyComment,
    resolveSuggestion, resolveComment, mergeComment, toggleLock, createVersion, startBatch, confirmComment,
    withdrawComment, closeBatch, addConflict, resolveConflict, dismissConflict,
    undo, redo, save, resetDemo,
  } = useReviewStore()
  const [composerOpen, setComposerOpen] = useState(false)
  const [commentType, setCommentType] = useState<CommentType>('comment')
  const [commentBody, setCommentBody] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [quote, setQuote] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [versionOpen, setVersionOpen] = useState(false)
  const [versionA, setVersionA] = useState(versions[1]?.id ?? versions[0]?.id)
  const [versionB, setVersionB] = useState(versions[0]?.id)
  const [versionLabel, setVersionLabel] = useState('')
  const [batchModalId, setBatchModalId] = useState<string | null>(null)
  const [batchLabelDraft, setBatchLabelDraft] = useState('')
  const [closeVersionLabel, setCloseVersionLabel] = useState('')

  const selected = paragraphs.find((paragraph) => paragraph.id === selectedParagraphId) ?? paragraphs[0]
  const sections = useMemo(() => Array.from(new Set(paragraphs.map((paragraph) => paragraph.section))), [paragraphs])
  const paragraphCommentCounts = useMemo(() => comments.reduce<Record<string, number>>((acc, comment) => {
    acc[comment.paragraphId] = (acc[comment.paragraphId] ?? 0) + 1
    return acc
  }, {}), [comments])
  const duplicateParagraphIds = useMemo(() => new Set(Object.entries(paragraphCommentCounts).filter(([, count]) => count > 1).map(([id]) => id)), [paragraphCommentCounts])
  const openBatch = useMemo(() => batches.find((batch) => batch.status === 'open'), [batches])
  const modalBatch = batches.find((batch) => batch.id === batchModalId) ?? null
  const staleIds = useMemo(() => getStaleCommentIds(paragraphs, comments, batches), [paragraphs, comments, batches])
  const batchStats = useMemo(() => {
    if (!openBatch) return null
    const trackedIds = new Set(Object.keys(openBatch.commentBaselines))
    const tracked = comments.filter((comment) => trackedIds.has(comment.id))
    const pending = tracked.filter((comment) => comment.status === 'open')
    const stale = pending.filter((comment) => staleIds.has(comment.id))
    const changedParagraphs = paragraphs.filter((paragraph) => openBatch.paragraphSnapshots[paragraph.id] !== undefined && openBatch.paragraphSnapshots[paragraph.id] !== paragraph.text)
    return { tracked, pending, stale, changedParagraphs, percent: tracked.length ? Math.round(((tracked.length - pending.length) / tracked.length) * 100) : 100 }
  }, [openBatch, comments, paragraphs, staleIds])
  const visibleComments = useMemo(() => comments.filter((comment) => {
    if (commentFilter === 'open') return comment.status === 'open'
    if (commentFilter === 'suggestion') return comment.type === 'suggestion' && comment.status === 'open'
    if (commentFilter === 'duplicate') return duplicateParagraphIds.has(comment.paragraphId) && comment.status === 'open'
    if (commentFilter === 'stale') return staleIds.has(comment.id)
    return true
  }).sort((a, b) => b.createdAt - a.createdAt), [commentFilter, comments, duplicateParagraphIds, staleIds])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      const state = useReviewStore.getState()
      const index = state.paragraphs.findIndex((paragraph) => paragraph.id === state.selectedParagraphId)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? state.redo() : state.undo()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault(); state.redo()
      } else if (event.key.toLowerCase() === 'j') {
        event.preventDefault(); const next = state.paragraphs[Math.min(state.paragraphs.length - 1, index + 1)]; if (next) state.selectParagraph(next.id)
      } else if (event.key.toLowerCase() === 'k') {
        event.preventDefault(); const previous = state.paragraphs[Math.max(0, index - 1)]; if (previous) state.selectParagraph(previous.id)
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault(); state.setRevisionMode(!state.revisionMode)
      } else if (event.key.toLowerCase() === 'l' && state.role === 'editor') {
        event.preventDefault(); state.toggleLock(state.selectedParagraphId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const scrollToParagraph = (id: string) => {
    selectParagraph(id)
    document.getElementById(`paragraph-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const openComposer = (type: CommentType) => {
    const selectedText = window.getSelection()?.toString().trim()
    setQuote(selectedText && selected?.text.includes(selectedText) ? selectedText : selected?.text.slice(0, 64) ?? '')
    setSuggestion(type === 'suggestion' ? selected?.text ?? '' : '')
    setCommentType(type)
    setComposerOpen(true)
  }
  const submitComment = () => {
    if (!selected || !commentBody.trim()) { message.warning('请填写批注内容'); return }
    addComment({ paragraphId: selected.id, type: commentType, quote, body: commentBody.trim(), suggestion: commentType === 'suggestion' ? suggestion : undefined })
    setCommentBody(''); setSuggestion(''); setQuote(''); setComposerOpen(false)
    message.success(openBatch
      ? `${commentType === 'suggestion' ? '修改建议' : '段落批注'}已提交并归入「${openBatch.label}」`
      : commentType === 'suggestion' ? '修改建议已提交' : '段落批注已添加')
  }
  const handleMockConflict = async () => {
    if (!selected) return
    const response = await submitRemotePatch(selected)
    addConflict({
      id: `conflict-${Date.now()}`, paragraphId: selected.id, localText: selected.text, remoteText: response.remoteText,
      localAuthor: roleMeta[role].label, remoteAuthor: response.remoteAuthor, detectedAt: Date.now(),
    })
    message.warning('模拟接口返回了同段落的远端修改，请处理冲突')
  }
  const handleCreateVersion = () => {
    if (versionLabel.trim()) createVersion(versionLabel.trim())
    else createVersion('')
    setVersionLabel('')
    message.success('当前版本已保存')
  }
  const handleStartBatch = () => {
    if (useReviewStore.getState().batches.some((batch) => batch.status === 'open')) { message.warning('已有进行中的批次，请先结束当前批次'); return }
    startBatch(batchLabelDraft || undefined)
    setBatchLabelDraft('')
    const started = useReviewStore.getState().batches.find((batch) => batch.status === 'open')
    message.success(`审阅批次「${started?.label ?? ''}」已开始：段落文字与待处理意见已记录`)
  }
  const handleCloseBatch = () => {
    if (!modalBatch) return
    const result = closeBatch(closeVersionLabel || undefined)
    if (!result.ok) { message.warning(result.reason ?? '暂时无法结束批次'); return }
    const savedVersion = useReviewStore.getState().versions[0]
    message.success(`批次「${modalBatch.label}」已结束，正文已保存为新版本「${savedVersion?.label}」`)
    setCloseVersionLabel('')
  }
  const comparedA = versions.find((version) => version.id === versionA)
  const comparedB = versions.find((version) => version.id === versionB)
  const comparedRows = comparedA && comparedB ? comparedA.paragraphs.map((paragraph, index) => ({ a: paragraph, b: comparedB.paragraphs[index] })) : []

  const renderBatchItem = (batch: ReviewBatch, comment: Comment, mode: 'stale' | 'pending' | 'done') => {
    const paragraph = paragraphs.find((item) => item.id === comment.paragraphId)
    const baseline = batch.commentBaselines[comment.id]
    const currentText = paragraph?.text ?? ''
    return (
      <div key={comment.id} className="batch-item">
        <div className="batch-item-head">
          <Space size={4} wrap>
            <Tag>{paragraph?.number ?? '?'}</Tag>
            <Tag color={comment.type === 'suggestion' ? 'gold' : 'default'}>{comment.type === 'suggestion' ? '修改建议' : '段落批注'}</Tag>
            <span>{comment.author}</span>
            {mode === 'done' && <Tag color={commentStatusMeta[comment.status].color}>{commentStatusMeta[comment.status].label}</Tag>}
          </Space>
          <Button size="small" type="text" onClick={() => { setBatchModalId(null); paragraph && scrollToParagraph(paragraph.id) }}>跳转段落</Button>
        </div>
        {mode === 'stale' && (
          <Alert
            className="batch-stale-alert" type="warning" showIcon icon={<WarningOutlined />}
            message="意见所依据的原文已变化，已暂停接受，等待审稿人按新文字确认或撤回"
            description={(
              <div className="stale-diff">
                <div><small>意见针对的旧文字</small><p>{baseline}</p></div>
                <div><small>当前新文字</small><p>{currentText}</p></div>
              </div>
            )}
          />
        )}
        <p className="batch-item-body">{comment.body}</p>
        {comment.suggestion && <div className="suggestion-box"><small>建议改为</small><p>{comment.suggestion}</p></div>}
        {mode === 'stale' && (
          role === 'reviewer' ? (
            <div className="decision-row">
              <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => { confirmComment(comment.id); message.success('已按新文字确认，意见恢复为待处理') }}>按新文字确认</Button>
              <Button danger size="small" icon={<StopOutlined />} onClick={() => withdrawComment(comment.id)}>撤回该意见</Button>
            </div>
          ) : <p className="batch-item-note">仅审稿人可确认或撤回；撤回后视为已处理。</p>
        )}
        {mode === 'pending' && <p className="batch-item-note">
          {comment.type === 'suggestion' ? '等待作者在右侧逐条接受或拒绝。' : '等待作者修订后由编辑标记已处理（重复意见可合并）。'}
        </p>}
      </div>
    )
  }

  return (
    <div className="review-app">
      <header className="app-header">
        <div className="paper-identity">
          <div className="paper-mark">CR</div>
          <div><h1>学术论文协作审阅台</h1><p>Collaborative Research Review · MS-2026-0417</p></div>
        </div>
        <div className="role-switch">
          <Segmented block value={role} onChange={(value) => setRole(value as Role)} options={(Object.keys(roleMeta) as Role[]).map((item) => ({ label: <span>{roleIcon(item)} {roleMeta[item].label.replace('工作区', '')}</span>, value: item }))} />
        </div>
        <Space>
          <Badge dot={dirty}><Button icon={<SaveOutlined />} onClick={() => { save(); message.success('草稿已保存到浏览器') }}>保存</Button></Badge>
          <Button icon={<UndoOutlined />} disabled={!useReviewStore.getState().past.length} onClick={undo} />
          <Button icon={<RedoOutlined />} disabled={!useReviewStore.getState().future.length} onClick={redo} />
          <Button danger={conflicts.length > 0} icon={<SwapOutlined />} onClick={() => void handleMockConflict()}>模拟冲突</Button>
        </Space>
      </header>

      <div className="role-banner" style={{ '--role-color': roleMeta[role].color } as React.CSSProperties}>
        <span className="role-badge">{roleIcon(role)} {roleMeta[role].label}</span>
        <span>{roleMeta[role].description}</span>
        {openBatch && <span className="batch-banner-chip"><AuditOutlined /> {openBatch.label} 进行中 · {batchStats?.pending.length ?? 0} 条待处理{batchStats && batchStats.stale.length > 0 ? `（${batchStats.stale.length} 条过时）` : ''}</span>}
        <span className="paper-state"><FileTextOutlined /> 论文正文 v2.4</span>
      </div>

      {conflicts.length > 0 && (
        <div className="conflict-stack">
          {conflicts.map((conflict) => (
            <Alert
              key={conflict.id} type="error" showIcon message={`段落冲突：${conflict.localAuthor} 与 ${conflict.remoteAuthor} 同时修改`}
              description={(
                <div className="conflict-content">
                  <div><b>本页版本</b><p>{conflict.localText}</p></div>
                  <div><b>模拟远端版本</b><p>{conflict.remoteText}</p></div>
                  <Space><Button size="small" onClick={() => resolveConflict(conflict.id, 'local')}>保留本页</Button><Button size="small" type="primary" onClick={() => resolveConflict(conflict.id, 'remote')}>采用远端</Button><Button size="small" type="text" onClick={() => dismissConflict(conflict.id)}>稍后处理</Button></Space>
                </div>
              )}
            />
          ))}
        </div>
      )}

      <main className="workspace">
        <aside className="toc-panel">
          <div className="batch-box">
            <div className="panel-title"><AuditOutlined /> 审阅批次</div>
            {openBatch && batchStats ? (
              <div className="batch-card open">
                <div className="batch-card-head"><Tag color="processing">进行中</Tag><strong>{openBatch.label}</strong></div>
                <p className="batch-dates">开始 {formatDate(openBatch.startedAt)}</p>
                <Progress percent={batchStats.percent} size="small" status={batchStats.stale.length ? 'exception' : 'active'} />
                <p className="batch-line">
                  待处理 {batchStats.pending.length} 条 · 过时 <b className={batchStats.stale.length ? 'danger-text' : ''}>{batchStats.stale.length}</b> 条 · {batchStats.changedParagraphs.length} 段已改
                </p>
                <Button block size="small" type="primary" ghost icon={<FileDoneOutlined />} onClick={() => setBatchModalId(openBatch.id)}>查看并处理批次</Button>
                <p className="batch-role-tip">
                  {role === 'editor' ? '全部意见处理完后，可在批次面板结束并存为新版本。'
                    : role === 'reviewer' ? '新添加的批注与建议会自动归入本批次；旧文字上的意见过时后请确认或撤回。'
                      : '正文改动会使旧建议标记过时；请只处理未过时的建议。'}
                </p>
              </div>
            ) : (
              <div className="batch-card closed">
                <p className="batch-idle-tip">{role === 'editor' ? '尚无进行中的批次。开始后将冻结各段文字，并把当前待处理意见收进批次。' : '当前没有进行中的审阅批次。'}</p>
                {role === 'editor' && (
                  <>
                    <Input size="small" value={batchLabelDraft} onChange={(event) => setBatchLabelDraft(event.target.value)} placeholder="批次名称（可选，如 第三轮外审）" onPressEnter={handleStartBatch} />
                    <Button block size="small" type="primary" icon={<PlayCircleOutlined />} onClick={handleStartBatch}>开始审阅批次</Button>
                  </>
                )}
                {batches.filter((batch) => batch.status === 'closed').length > 0 && (
                  <div className="batch-history">
                    <small>已结束批次</small>
                    {batches.filter((batch) => batch.status === 'closed').map((batch) => {
                      const version = versions.find((item) => item.id === batch.versionId)
                      return (
                        <button key={batch.id} className="batch-history-item" onClick={() => setBatchModalId(batch.id)}>
                          <CheckCircleOutlined />
                          <span>{batch.label}<small>{batch.closedAt ? formatDate(batch.closedAt) : ''}{version ? ` · 已存为「${version.label}」` : ''}</small></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="panel-title"><MenuFoldOutlined /> 侧边目录</div>
          <nav>
            {sections.map((section) => (
              <div key={section} className="toc-section">
                <strong>{section}</strong>
                {paragraphs.filter((paragraph) => paragraph.section === section).map((paragraph) => (
                  <button key={paragraph.id} className={paragraph.id === selected?.id ? 'active' : ''} onClick={() => scrollToParagraph(paragraph.id)}>
                    <span>{paragraph.number}</span>
                    <span>{paragraph.text.slice(0, 24)}…</span>
                    {paragraph.status === 'locked' && <LockOutlined />}
                    {!!paragraphCommentCounts[paragraph.id] && <Badge count={paragraphCommentCounts[paragraph.id]} size="small" />}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="version-box">
            <div className="panel-title"><HistoryOutlined /> 版本</div>
            <Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="新版本名称" onPressEnter={handleCreateVersion} />
            <Button block icon={<PlusOutlined />} onClick={handleCreateVersion}>保存当前版本</Button>
            <Button block icon={<DiffOutlined />} onClick={() => setVersionOpen(true)}>比较两个版本</Button>
          </div>
        </aside>

        <section className="document-panel">
          <div className="document-toolbar">
            <div><h2>大语言模型辅助下的开源维护协作研究</h2><p>作者：林晓、陈默、王远 · 最近保存 {formatDate(Date.now())}</p></div>
            <Space>
              <Checkbox checked={revisionMode} onChange={(event) => setRevisionMode(event.target.checked)}>修订模式</Checkbox>
              <Tag color={dirty ? 'gold' : 'green'}>{dirty ? '有未保存修改' : '已保存'}</Tag>
            </Space>
          </div>

          <div className="paper-sheet">
            <div className="paper-kicker">RESEARCH ARTICLE · CONFIDENTIAL REVIEW</div>
            {sections.map((section) => (
              <section key={section} className="paper-section">
                <h3>{section}</h3>
                {paragraphs.filter((paragraph) => paragraph.section === section).map((paragraph) => {
                  const batchChanged = openBatch && openBatch.paragraphSnapshots[paragraph.id] !== undefined && openBatch.paragraphSnapshots[paragraph.id] !== paragraph.text
                  return (
                    <article
                      id={`paragraph-${paragraph.id}`} key={paragraph.id} onMouseUp={() => setQuote(window.getSelection()?.toString().trim() ?? '')}
                      className={`paragraph-card ${paragraph.id === selected?.id ? 'selected' : ''} ${paragraph.highlighted ? 'highlighted' : ''} ${paragraph.status === 'locked' ? 'locked' : ''}`}
                      onClick={() => selectParagraph(paragraph.id)}
                    >
                      <div className="paragraph-meta">
                        <span className="paragraph-no">{paragraph.number}</span>
                        <span>段落 {paragraph.number.replace('.', '')}</span>
                        {paragraph.status === 'locked' && <Tag icon={<LockOutlined />} color="purple">已锁定</Tag>}
                        {paragraph.status === 'accepted' && <Tag icon={<CheckOutlined />} color="green">已确认</Tag>}
                        {batchChanged && <Tag color="orange" icon={<WarningOutlined />}>本批次已改</Tag>}
                        {!!paragraphCommentCounts[paragraph.id] && <Tag icon={<MessageOutlined />}>{paragraphCommentCounts[paragraph.id]} 条意见</Tag>}
                      </div>
                      {revisionMode ? (
                        <div className="revision-grid">
                          <div><small>原稿</small><p>{paragraph.original}</p></div>
                          <div><small>当前修订</small><p>{paragraph.text}</p></div>
                        </div>
                      ) : role === 'author' ? (
                        <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={paragraph.text} readOnly={paragraph.status === 'locked'} onChange={(event) => updateParagraph(paragraph.id, event.target.value)} />
                      ) : (
                        <p className="paragraph-text">{paragraph.text}</p>
                      )}
                      <div className="paragraph-actions">
                        {role === 'reviewer' && <><Button size="small" icon={<CommentOutlined />} onClick={(event) => { event.stopPropagation(); selectParagraph(paragraph.id); openComposer('comment') }}>添加批注</Button><Button size="small" icon={<FileDoneOutlined />} onClick={(event) => { event.stopPropagation(); selectParagraph(paragraph.id); openComposer('suggestion') }}>提出建议</Button></>}
                        {role === 'editor' && <Button size="small" icon={paragraph.status === 'locked' ? <UnlockOutlined /> : <LockOutlined />} onClick={(event) => { event.stopPropagation(); toggleLock(paragraph.id) }}>{paragraph.status === 'locked' ? '解除锁定' : '锁定段落'}</Button>}
                        {role === 'author' && <span className="author-tip">可直接修改正文，右侧逐条处理建议</span>}
                      </div>
                    </article>
                  )
                })}
              </section>
            ))}
          </div>
        </section>

        <aside className="comments-panel">
          <div className="comments-header">
            <div className="comments-header-row">
              <h2><CommentOutlined /> 审阅意见 <Badge count={comments.filter((comment) => comment.status === 'open').length} /></h2>
              {staleIds.size > 0 && <Tag color="orange" icon={<WarningOutlined />}>{staleIds.size} 条过时待确认</Tag>}
            </div>
            <p>引用原文、讨论与修订建议{openBatch ? ` · 均归入「${openBatch.label}」` : ''}</p>
          </div>
          <div className="comment-filters">
            <Radio.Group value={commentFilter} onChange={(event) => setCommentFilter(event.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="all">全部</Radio.Button><Radio.Button value="open">待处理</Radio.Button><Radio.Button value="suggestion">建议</Radio.Button><Radio.Button value="duplicate">重复</Radio.Button><Radio.Button value="stale">过时</Radio.Button>
            </Radio.Group>
          </div>
          <div className="comment-list">
            {visibleComments.map((comment) => {
              const paragraph = paragraphs.find((item) => item.id === comment.paragraphId)
              const stale = staleIds.has(comment.id)
              return (
                <Card key={comment.id} size="small" className={`comment-card ${comment.status} ${stale ? 'stale' : ''}`} title={<span>{comment.author} <Tag>{comment.type === 'suggestion' ? '修改建议' : '段落批注'}</Tag>{stale && <Tag color="orange" icon={<WarningOutlined />}>过时</Tag>}</span>} extra={<small>{formatDate(comment.createdAt)}</small>}>
                  <button className="quote-line" onClick={() => paragraph && scrollToParagraph(paragraph.id)}>“{comment.quote}” · 段落 {paragraph?.number}</button>
                  <p className="comment-body">{comment.body}</p>
                  {comment.suggestion && <div className="suggestion-box"><small>建议改为</small><p>{comment.suggestion}</p></div>}
                  {stale ? (
                    <Alert
                      className="stale-alert" type="warning" showIcon icon={<WarningOutlined />}
                      message="原文已在本批次中修改，该意见已过时，暂停接受"
                      description={role === 'reviewer'
                        ? '请对照新文字：确认后意见重新进入待处理；若不再适用可撤回。'
                        : '等待审稿人按新文字确认或撤回后才能继续处理。'}
                    />
                  ) : comment.status !== 'open' && <Tag color={commentStatusMeta[comment.status].color}>{commentStatusMeta[comment.status].label}</Tag>}
                  <div className="replies">
                    {comment.replies.map((reply) => <div key={reply.id} className="reply"><b>{reply.author}</b><span>{reply.body}</span></div>)}
                  </div>
                  <div className="reply-box">
                    <Input size="small" value={replyDrafts[comment.id] ?? ''} onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: event.target.value }))} placeholder="回复讨论…" onPressEnter={() => { const body = replyDrafts[comment.id]?.trim(); if (body) { replyComment(comment.id, body); setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: '' })) } }} />
                    <Button size="small" type="text" icon={<SendOutlined />} onClick={() => { const body = replyDrafts[comment.id]?.trim(); if (body) { replyComment(comment.id, body); setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: '' })) } }} />
                  </div>
                  {comment.status === 'open' && !stale && role === 'author' && comment.type === 'suggestion' && <div className="decision-row"><Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => resolveSuggestion(comment.id, true)}>接受修改</Button><Button danger size="small" icon={<CloseOutlined />} onClick={() => resolveSuggestion(comment.id, false)}>拒绝</Button></div>}
                  {comment.status === 'open' && !stale && role === 'editor' && comment.type === 'comment' && <div className="decision-row"><Button type="primary" size="small" ghost icon={<CheckOutlined />} onClick={() => resolveComment(comment.id)}>标记已处理</Button>{duplicateParagraphIds.has(comment.paragraphId) && (() => {
                    const sibling = comments.find((item) => item.id !== comment.id && item.paragraphId === comment.paragraphId && item.status === 'open')
                    return sibling ? <Button size="small" type="dashed" icon={<BranchesOutlined />} onClick={() => mergeComment(comment.id, sibling.id)}>合并到“{sibling.author}”意见</Button> : null
                  })()}</div>}
                  {stale && role === 'reviewer' && <div className="decision-row"><Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => confirmComment(comment.id)}>按新文字确认</Button><Button danger size="small" icon={<StopOutlined />} onClick={() => withdrawComment(comment.id)}>撤回</Button></div>}
                </Card>
              )
            })}
            {!visibleComments.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={commentFilter === 'stale' ? '没有过时意见' : '当前筛选下没有意见'} />}
          </div>
          <div className="keyboard-hint"><span><kbd>J</kbd>/<kbd>K</kbd> 段落导航</span><span><kbd>T</kbd> 修订模式</span>{role === 'editor' && <span><kbd>L</kbd> 锁定</span>}<span><kbd>⌘Z</kbd> 撤销</span></div>
        </aside>
      </main>

      <Modal title={commentType === 'suggestion' ? '提出修改建议' : '添加段落批注'} open={composerOpen} onCancel={() => setComposerOpen(false)} onOk={submitComment} okText="提交" width={620}>
        <div className="composer">
          <label>引用原文</label>
          <Input.TextArea value={quote} onChange={(event) => setQuote(event.target.value)} autoSize={{ minRows: 2, maxRows: 4 }} />
          <label>{commentType === 'suggestion' ? '建议改为' : '批注内容'}</label>
          {commentType === 'suggestion' && <Input.TextArea value={suggestion} onChange={(event) => setSuggestion(event.target.value)} autoSize={{ minRows: 3, maxRows: 7 }} />}
          <label>说明</label>
          <Input.TextArea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="说明修改理由或希望作者关注的问题" autoSize={{ minRows: 2, maxRows: 5 }} />
          {openBatch && <Alert type="info" showIcon message={`该意见会自动归入进行中的「${openBatch.label}」`} />}
        </div>
      </Modal>

      <Modal title="版本比较" open={versionOpen} onCancel={() => setVersionOpen(false)} footer={null} width={980}>
        <div className="compare-selectors">
          <Select value={versionA} onChange={setVersionA} options={versions.map((version) => ({ label: `${version.label} · ${formatDate(version.createdAt)}`, value: version.id }))} />
          <ArrowRightOutlined />
          <Select value={versionB} onChange={setVersionB} options={versions.map((version) => ({ label: `${version.label} · ${formatDate(version.createdAt)}`, value: version.id }))} />
        </div>
        <div className="version-table">
          <div className="version-head"><b>{comparedA?.label ?? '版本 A'}</b><b>{comparedB?.label ?? '版本 B'}</b></div>
          {comparedRows.map(({ a, b }) => (
            <div key={a.id} className={`version-row ${a.text !== b?.text ? 'changed' : ''}`}>
              <div><span>{a.number}</span>{a.text}</div><div><span>{b?.number ?? '—'}</span>{b?.text ?? '段落已删除'}</div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title={<Space>{modalBatch?.label}{modalBatch?.status === 'open' ? <Tag color="processing">进行中</Tag> : <Tag color="success">已结束</Tag>}</Space>}
        open={!!modalBatch} onCancel={() => setBatchModalId(null)} width={820}
        footer={modalBatch?.status === 'open' && role === 'editor' ? (
          <div className="batch-close-bar">
            <Input value={closeVersionLabel} onChange={(event) => setCloseVersionLabel(event.target.value)} placeholder="定稿版本名称（可选）" />
            <Tooltip title="所有意见处理完后才能结束，并把正文存成新版本">
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleCloseBatch}>结束批次并存新版本</Button>
            </Tooltip>
          </div>
        ) : null}
      >
        {modalBatch && (() => {
          const trackedIds = new Set(Object.keys(modalBatch.commentBaselines))
          const tracked = comments.filter((comment) => trackedIds.has(comment.id))
          const pending = tracked.filter((comment) => comment.status === 'open')
          const stale = pending.filter((comment) => staleIds.has(comment.id))
          const waiting = pending.filter((comment) => !staleIds.has(comment.id))
          const done = tracked.filter((comment) => comment.status !== 'open')
          const changedParagraphs = paragraphs.filter((paragraph) => modalBatch.paragraphSnapshots[paragraph.id] !== undefined && modalBatch.paragraphSnapshots[paragraph.id] !== paragraph.text)
          return (
            <div className="batch-detail">
              {modalBatch.status === 'open' ? (
                <Alert
                  type="info" showIcon
                  message={`批次开始于 ${formatDate(modalBatch.startedAt)}，已记录 ${tracked.length} 条意见、${paragraphs.length} 段文字`}
                  description="段落文字变化后，旧文字上的待处理意见会标记为过时并暂停接受；需由审稿人按新文字确认或撤回。全部意见处理完后，编辑才能结束批次并把正文存为新版本。草稿会自动保存在浏览器中，未结束的批次重开后可继续处理。"
                />
              ) : (
                <Alert
                  type="success" showIcon icon={<CheckCircleOutlined />}
                  message={`批次已于 ${modalBatch.closedAt ? formatDate(modalBatch.closedAt) : ''} 结束，正文已保存为新版本「${versions.find((item) => item.id === modalBatch.versionId)?.label ?? '—'}」`}
                  description={`共处理 ${tracked.length} 条意见，${changedParagraphs.length} 个段落相对批次开始时发生变化。`}
                />
              )}

              {modalBatch.status === 'open' && (
                <div className="batch-progress-row"><Progress percent={tracked.length ? Math.round((done.length / tracked.length) * 100) : 100} size="small" status={stale.length ? 'exception' : 'active'} /><span>{done.length}/{tracked.length}</span></div>
              )}

              {stale.length > 0 && (
                <div className="batch-section">
                  <h4><WarningOutlined /> 过时待审稿人确认（{stale.length}）</h4>
                  {stale.map((comment) => renderBatchItem(modalBatch, comment, 'stale'))}
                </div>
              )}
              {waiting.length > 0 && modalBatch.status === 'open' && (
                <div className="batch-section">
                  <h4><FileDoneOutlined /> 待处理（{waiting.length}）</h4>
                  {waiting.map((comment) => renderBatchItem(modalBatch, comment, 'pending'))}
                </div>
              )}
              <div className="batch-section">
                <h4><CheckCircleOutlined /> 已处理（{done.length}）</h4>
                {done.length ? done.map((comment) => renderBatchItem(modalBatch, comment, 'done')) : <p className="batch-item-note">暂无已处理意见。</p>}
              </div>
            </div>
          )
        })()}
      </Modal>

      <footer className="app-footer">
        <span>本地草稿自动持久化（含进行中的审阅批次） · 模拟接口用于演示多人修改后的冲突处理</span>
        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => { resetDemo(); message.success('已重置示例数据') }}>重置示例</Button>
      </footer>
    </div>
  )
}
